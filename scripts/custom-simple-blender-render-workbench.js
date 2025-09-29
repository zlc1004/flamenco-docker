// SPDX-License-Identifier: GPL-3.0-or-later

const JOB_TYPE = {
    label: "Simple Blender Render Workbench (No Video)",
    description: "Fast Workbench engine rendering sequence of frames without creating preview video",
    settings: [
        // Settings for artists to determine:
        { key: "frames", type: "string", required: true,
          eval: "f'{C.scene.frame_start}-{C.scene.frame_end}'",
          evalInfo: {
            showLinkButton: true,
            description: "Scene frame range",
          },
          description: "Frame range to render. Examples: '47', '1-30', '3, 5-10, 47-327'" },
        { key: "chunk_size", type: "int32", default: 1, description: "Number of frames to render in one Blender render task",
          visible: "submission" },

        { key: "render_output_path", type: "string", subtype: "file_path", editable: false,
          eval: "f'/mnt/shared/flamenco/jobs/{jobname}/render/######'",
          description: "Final file path of where render output will be saved"},

        // Extra CLI arguments for Blender, for debugging purposes.
        {
          key: 'blender_args_before',
          label: 'Blender CLI args: Before',
          description: 'CLI arguments for Blender, placed before the .blend filename',
          type: 'string',
          required: false,
        },
        {
          key: 'blender_args_after',
          label: 'After',
          description: 'CLI arguments for Blender, placed after the .blend filename',
          type: 'string',
          required: false,
        },

        // Automatically evaluated settings:
        { key: "blendfile", type: "string", required: true, description: "Path of the Blend file to render", visible: "web" },
        { key: "format", type: "string", required: true, eval: "C.scene.render.image_settings.file_format", visible: "web" },
        { key: "image_file_extension", type: "string", required: true, eval: "C.scene.render.file_extension", visible: "hidden",
          description: "File extension used when rendering images" },
        { key: "scene", type: "string", required: true, eval: "C.scene.name", visible: "web",
          description: "Name of the scene to render."},
    ]
};


function compileJob(job) {
    print("Blender Workbench Render job submitted (No Video)");
    print("job: ", job);

    const settings = job.settings;
    
    // Extract the actual job directory from the blend file path
    const blendFilePath = settings.blendfile;
    const jobDir = path.dirname(blendFilePath); // e.g., "/mnt/shared/flamenco/jobs/Untitled1-ym2c"
    const actualRenderOutput = path.join(jobDir, "render", "######");
    
    print("Blend file path:", blendFilePath);
    print("Job directory:", jobDir);
    print("Render output:", actualRenderOutput);
    
    // Update the render output path to use the actual job directory
    settings.render_output_path = actualRenderOutput;

    const renderDir = path.dirname(actualRenderOutput);
    const renderTasks = authorRenderTasks(settings, renderDir, actualRenderOutput);

    for (const rt of renderTasks) {
        job.addTask(rt);
    }

    cleanupJobSettings(job.settings);
}

// Workbench engine configuration Python code
const workbench_script = `
import bpy

print("=== Configuring Blender for Workbench rendering ===")

# Set render engine to Workbench
bpy.context.scene.render.engine = 'BLENDER_WORKBENCH'
print(f"✓ Render engine set to: {bpy.context.scene.render.engine}")

try:
    scene = bpy.context.scene
    workbench = scene.display
    
    # Configure Workbench shading settings
    workbench.shading.type = 'MATERIAL'  # Use material shading
    workbench.shading.light = 'STUDIO'   # Use studio lighting
    workbench.shading.studio_light = 'forest.exr'  # Default studio light
    workbench.shading.studiolight_rotate_z = 0.0
    workbench.shading.studiolight_intensity = 1.0
    workbench.shading.studiolight_background_alpha = 0.5
    workbench.shading.studiolight_background_blur = 0.5
    
    print("✓ Workbench shading configured:")
    print(f"  - Shading type: {workbench.shading.type}")
    print(f"  - Light: {workbench.shading.light}")
    print(f"  - Studio light: {workbench.shading.studio_light}")
    
    # Configure render settings for quality
    render = scene.render
    render.resolution_percentage = 100
    render.use_high_quality_normals = True
    
    # Workbench specific render settings
    if hasattr(scene, 'display'):
        display = scene.display
        if hasattr(display.shading, 'use_dof'):
            display.shading.use_dof = False  # Disable depth of field for speed
        if hasattr(display.shading, 'use_scene_lights'):
            display.shading.use_scene_lights = False  # Use studio lights
        if hasattr(display.shading, 'use_scene_world'):
            display.shading.use_scene_world = False  # Use studio world
    
    # Viewport shading settings (affects workbench rendering)
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    space.shading.light = 'STUDIO'
                    break
    
    print("✓ Additional Workbench optimizations applied")

except Exception as e:
    print(f"ERROR: Workbench configuration failed: {e}")
    import traceback
    traceback.print_exc()

print("=== Workbench configuration complete ===")
`.trim();

function authorRenderTasks(settings, renderDir, renderOutput) {
    print("authorRenderTasks(", renderDir, renderOutput, ")");
    let renderTasks = [];
    let chunks = frameChunker(settings.frames, settings.chunk_size);

    // Extra arguments for Blender - simple split on spaces or empty array if not provided
    const blender_args_before = settings.blender_args_before ? settings.blender_args_before.split(' ').filter(arg => arg.length > 0) : [];
    const blender_args_after = settings.blender_args_after ? settings.blender_args_after.split(' ').filter(arg => arg.length > 0) : [];

    let baseArgs = [];
    if (settings.scene) {
      baseArgs = baseArgs.concat(["--scene", settings.scene]);
    }

    for (let chunk of chunks) {
        const task = author.Task(`render-${chunk}`, "blender");
        
        // Add a command to create the render directory first
        const mkdirCommand = author.Command("exec", {
            exe: "mkdir",
            args: ["-p", renderDir]
        });
        task.addCommand(mkdirCommand);
        
        // Create a temporary Python file with Workbench configuration
        const workbenchPyPath = path.join(renderDir, "workbench_config.py");
        const createWorkbenchScript = author.Command("exec", {
            exe: "sh",
            args: ["-c", `cat > "${workbenchPyPath}" << 'EOF'\n${workbench_script}\nEOF`]
        });
        task.addCommand(createWorkbenchScript);
        
        // Build command arguments in correct order per Blender documentation
        let args = [
            '-o', 
            path.join(renderDir, 'frame_'),
            '-F',
            settings.format,
            '--python',
            workbenchPyPath,
        ].concat(blender_args_after);
        
        // Parse the chunk and add frame arguments at the end
        if (chunk.includes('-')) {
            // Handle frame range like "1-100" - use -s -e -a
            const [start, end] = chunk.split('-').map(f => parseInt(f.trim()));
            args = args.concat(['-s', start.toString(), '-e', end.toString(), '-a']);
        } else {
            // Handle single frame like "5" - use -f
            args = args.concat(['-f', chunk]);
        }
        
        const command = author.Command("blender-render", {
            exe: "{blender}",
            exeArgs: "-b -y -E BLENDER_WORKBENCH",
            argsBefore: blender_args_before,
            blendfile: settings.blendfile,
            args: args,
        });
        task.addCommand(command);
        renderTasks.push(task);
    }
    return renderTasks;
}

// Clean up empty job settings so that they're no longer shown in the web UI.
function cleanupJobSettings(settings) {
  const settings_to_check = [
    'blender_args_before',
    'blender_args_after',
  ];

  for (let setting_name of settings_to_check) {
    if (!settings[setting_name]) delete settings[setting_name];
  }
}