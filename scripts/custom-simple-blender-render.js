// SPDX-License-Identifier: GPL-3.0-or-later

const JOB_TYPE = {
    label: "Simple Blender Render CUDA GPU (No Video)",
    description: "CUDA GPU rendering sequence of frames without creating preview video",
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
    print("Blender CUDA GPU Render job submitted (No Video)");
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

// CUDA GPU enablement Python code - simplified and reliable
const enable_all_cuda = `
import bpy

print("=== Configuring Blender for CUDA GPU rendering ===")

# Set render engine to Cycles
bpy.context.scene.render.engine = 'CYCLES'

# Set device to GPU for scene rendering
bpy.context.scene.cycles.device = 'GPU'

# Get cycles preferences and configure CUDA
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'CUDA'
    prefs.get_devices()
    
    # Enable CUDA devices
    cuda_devices = [d for d in prefs.devices if d.type == 'CUDA']
    for device in cuda_devices:
        device.use = True
        print(f"✓ Enabled CUDA device: {device.name}")
    
    print(f"CUDA GPU rendering configured with {len(cuda_devices)} device(s)")
except Exception as e:
    print(f"Warning: CUDA configuration failed: {e}")
    print("Continuing with default GPU settings...")

print("=== Configuration complete ===")
`;

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

    // More arguments for Blender, which will be the same for each task.
    const task_invariant_args = [
        '--python-expr',
        enable_all_cuda,
        '--render-output',
        path.join(renderDir, path.basename(renderOutput)),
        '--render-format',
        settings.format,
    ].concat(blender_args_after);

    for (let chunk of chunks) {
        const task = author.Task(`render-${chunk}`, "blender");
        
        // Add a command to create the render directory first
        const mkdirCommand = author.Command("exec", {
            exe: "mkdir",
            args: ["-p", renderDir]
        });
        task.addCommand(mkdirCommand);
        
        const command = author.Command("blender-render", {
            exe: "{blender}",
            exeArgs: "-b -y -E CYCLES -- --cycles-device CUDA",
            argsBefore: blender_args_before,
            blendfile: settings.blendfile,
            args: task_invariant_args.concat([
                '--render-frame',
                chunk, // Use the chunk as-is, Blender expects 1-100 format
            ]),
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
