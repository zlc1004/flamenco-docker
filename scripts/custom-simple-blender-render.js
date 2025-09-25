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

// CUDA GPU enablement Python code - GPU-ONLY mode
const cuda_script = `
import bpy

print("=== Configuring Blender for CUDA GPU-ONLY rendering ===")

# Set render engine to Cycles
bpy.context.scene.render.engine = 'CYCLES'

# Set device to GPU for scene rendering
bpy.context.scene.cycles.device = 'GPU'

# Get cycles preferences and configure CUDA
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'CUDA'
    prefs.get_devices()
    
    # DISABLE ALL DEVICES FIRST, then enable only CUDA
    cuda_count = 0
    cpu_count = 0
    other_count = 0
    
    for device in prefs.devices:
        if device.type == 'CUDA':
            device.use = True
            cuda_count += 1
            print(f"✓ ENABLED CUDA device: {device.name}")
        else:
            device.use = False  # DISABLE CPU and other devices
            if device.type == 'CPU':
                cpu_count += 1
                print(f"✗ DISABLED CPU device: {device.name}")
            else:
                other_count += 1
                print(f"✗ DISABLED {device.type} device: {device.name}")
    
    print(f"=== GPU-ONLY configuration complete ===")
    print(f"CUDA devices enabled: {cuda_count}")
    print(f"CPU devices disabled: {cpu_count}")
    print(f"Other devices disabled: {other_count}")
    
except Exception as e:
    print(f"Warning: CUDA configuration failed: {e}")
    print("Continuing with default GPU settings...")

print("=== Configuration complete ===")
`.trim();

const b64encode = function (str) {
  // Simple base64 encoding without Node.js Buffer
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  while (i < str.length) {
    const a = str.charCodeAt(i++);
    const b = i < str.length ? str.charCodeAt(i++) : 0;
    const c = i < str.length ? str.charCodeAt(i++) : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += (i - 2) < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    result += (i - 1) < str.length ? chars.charAt(bitmap & 63) : '=';
  }
  
  return result;
};

// Base64 encode the script using our custom function
const cuda_script_b64 = b64encode(cuda_script)
const enable_all_cuda = `exec(__import__("base64").b64decode("${cuda_script_b64}").decode())`;

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
        
        // Build command arguments in correct order per Blender documentation
        let args = [
            '--python-expr',
            enable_all_cuda,
            '-o', 
            path.join(renderDir, 'frame_'),
            '-F',
            settings.format,
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
            exeArgs: "-b -y -E CYCLES",
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
