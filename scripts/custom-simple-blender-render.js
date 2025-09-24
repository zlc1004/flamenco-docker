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

// CUDA GPU enablement Python code
const enable_all_cuda = `
import bpy

print("=== Configuring Blender for CUDA GPU-only rendering ===")

# Set render engine to Cycles
bpy.context.scene.render.engine = 'CYCLES'

# Get cycles preferences
prefs = bpy.context.preferences.addons['cycles'].preferences

# Set compute device type to CUDA
prefs.compute_device_type = 'CUDA'

# Refresh devices to ensure we have the latest list
prefs.get_devices()

# Completely disable CPU devices, enable only CUDA devices
cuda_count = 0
cpu_count = 0
for device in prefs.devices:
    if device.type == 'CUDA':
        device.use = True
        cuda_count += 1
        print(f"✓ Enabled CUDA device: {device.name}")
    else:
        device.use = False
        if device.type == 'CPU':
            cpu_count += 1
        print(f"✗ Disabled device: {device.name} ({device.type})")

# Force GPU device on scene
bpy.context.scene.cycles.device = 'GPU'

print(f"=== CUDA GPU-only configuration complete ===")
print(f"Render engine: {bpy.context.scene.render.engine}")
print(f"Scene device: {bpy.context.scene.cycles.device}")
print(f"Compute device type: {prefs.compute_device_type}")
print(f"CUDA devices enabled: {cuda_count}")
print(f"CPU devices disabled: {cpu_count}")
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
        '--python-expr',
        "import bpy; bpy.context.scene.cycles.device = 'GPU'",
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
                chunk.replaceAll('-', '..'), // Convert to Blender frame range notation.
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
