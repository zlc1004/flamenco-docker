// Diagnostic CUDA render with detailed logging
const JOB_TYPE = {
    label: "Diagnose CUDA Rendering",
    description: "Render with detailed GPU diagnostics to troubleshoot performance",
    settings: [
        { key: "frames", type: "string", required: true,
          eval: "f'{C.scene.frame_start}-{C.scene.frame_end}'",
          description: "Frame range to render" },
        { key: "blendfile", type: "string", required: true, description: "Path of the Blend file to render", visible: "web" },
        { key: "format", type: "string", required: true, eval: "C.scene.render.image_settings.file_format", visible: "web" },
        { key: "render_output_path", type: "string", subtype: "file_path", editable: false,
          eval: "str(Path(bpy.data.filepath).parent.joinpath('render', '######')) if bpy.data.filepath else f'/mnt/shared/flamenco/jobs/{jobname}/render/######'",
          description: "Final file path of where render output will be saved"},
    ]
};

const diagnostic_cuda_setup = `
import bpy
import time

print("=== DIAGNOSTIC CUDA SETUP ===")
print(f"Starting setup at: {time.strftime('%Y-%m-%d %H:%M:%S')}")

# Set render engine to Cycles
bpy.context.scene.render.engine = 'CYCLES'
print(f"✓ Set render engine to: {bpy.context.scene.render.engine}")

# Get cycles preferences
prefs = bpy.context.preferences.addons['cycles'].preferences
print(f"✓ Got Cycles preferences")

# Set compute device type to CUDA
prefs.compute_device_type = 'CUDA'
print(f"✓ Set compute device type to: {prefs.compute_device_type}")

# Refresh devices
prefs.get_devices()
print(f"✓ Refreshed device list")

# Show all available devices BEFORE configuration
print("\\n=== BEFORE GPU Configuration ===")
for i, device in enumerate(prefs.devices):
    print(f"Device {i}: {device.name} | Type: {device.type} | Use: {device.use}")

# Configure devices - FORCE only CUDA, disable everything else
cuda_count = 0
cpu_count = 0
other_count = 0

for device in prefs.devices:
    if device.type == 'CUDA':
        device.use = True
        cuda_count += 1
        print(f"✓ ENABLED CUDA: {device.name}")
    else:
        device.use = False
        if device.type == 'CPU':
            cpu_count += 1
            print(f"✗ DISABLED CPU: {device.name}")
        else:
            other_count += 1
            print(f"✗ DISABLED {device.type}: {device.name}")

# Show all devices AFTER configuration
print("\\n=== AFTER GPU Configuration ===")
for i, device in enumerate(prefs.devices):
    print(f"Device {i}: {device.name} | Type: {device.type} | Use: {device.use}")

# Set scene to use GPU
bpy.context.scene.cycles.device = 'GPU'
print(f"✓ Set scene device to: {bpy.context.scene.cycles.device}")

# Additional Cycles settings for performance
scene = bpy.context.scene
print(f"\\n=== Cycles Settings ===")
print(f"Render samples: {scene.cycles.samples}")
print(f"Preview samples: {scene.cycles.preview_samples}")
print(f"Use denoising: {scene.cycles.use_denoising}")
print(f"Denoiser: {scene.cycles.denoiser}")

# Force minimal samples for testing
scene.cycles.samples = 10  # Very low for testing
scene.cycles.preview_samples = 5
print(f"✓ Set samples to {scene.cycles.samples} for fast testing")

print(f"\\n=== FINAL SUMMARY ===")
print(f"Render engine: {bpy.context.scene.render.engine}")
print(f"Scene device: {bpy.context.scene.cycles.device}")
print(f"Compute device type: {prefs.compute_device_type}")
print(f"CUDA devices enabled: {cuda_count}")
print(f"CPU devices disabled: {cpu_count}")
print(f"Other devices disabled: {other_count}")
print(f"Render samples: {scene.cycles.samples}")
print(f"Setup completed at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
`;

function compileJob(job) {
    print("Diagnostic CUDA Render job submitted");
    
    const settings = job.settings;
    const renderOutput = renderOutputPath(job);
    settings.render_output_path = renderOutput;
    
    const renderDir = path.dirname(renderOutput);
    
    let chunks = frameChunker(settings.frames, 1); // One frame at a time for testing
    
    for (let chunk of chunks) {
        const task = author.Task(`diagnose-render-${chunk}`, "blender");
        
        // Create render directory
        const mkdirCommand = author.Command("exec", {
            exe: "mkdir",
            args: ["-p", renderDir]
        });
        task.addCommand(mkdirCommand);
        
        // Render with diagnostic output
        const command = author.Command("blender-render", {
            exe: "{blender}",
            exeArgs: "-b -y -E CYCLES -a -- --cycles-device CUDA",
            argsBefore: [],
            blendfile: settings.blendfile,
            args: [
                '--python-expr', diagnostic_cuda_setup,
                '--python-expr', "import bpy, time; print(f'Starting render at: {time.strftime(\"%Y-%m-%d %H:%M:%S\")}')",
                '--render-output', renderOutput,
                '--render-format', settings.format,
                '--render-frame', chunk.replaceAll('-', '..')
            ],
        });
        task.addCommand(command);
        job.addTask(task);
    }
}

function renderOutputPath(job) {
    let path = job.settings.render_output_path;
    if (!path) {
        throw "no render_output_path setting!";
    }
    return path.replace(/{([^}]+)}/g, (match, group0) => {
        switch (group0) {
        case "timestamp":
            return formatTimestampLocal(job.created);
        default:
            return match;
        }
    });
}