// SPDX-License-Identifier: GPL-3.0-or-later

const JOB_TYPE = {
    label: "Simple Blender Render Eevee Next (No Video)",
    description: "Real-time Eevee Next engine rendering sequence of frames without creating preview video",
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
    print("Blender Eevee Next Render job submitted (No Video)");
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

// Eevee engine configuration Python code
const eevee_script = `
import bpy

print("=== Configuring Blender for Eevee Next rendering ===")

# Set render engine to Eevee
bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT'
print(f"✓ Render engine set to: {bpy.context.scene.render.engine}")

# FORCE GPU USAGE FOR EEVEE
try:
    # Get system preferences for GPU configuration
    prefs = bpy.context.preferences
    system = prefs.system
    
    # Force GPU compute for Eevee
    system.gpu_backend = 'OPENGL'  # or 'VULKAN' if available
    print(f"✓ GPU backend set to: {system.gpu_backend}")
    
    # Enable GPU subdivision if available
    if hasattr(system, 'use_gpu_subdivision'):
        system.use_gpu_subdivision = True
        print("✓ GPU subdivision enabled")
    
    # Configure memory and GPU settings
    system.memory_cache_limit = 4096  # 4GB cache
    system.gpu_memory_limit = 0  # Use all available GPU memory
    
    print("✓ GPU configuration for Eevee applied")
    
except Exception as e:
    print(f"Warning: GPU configuration failed: {e}")
    print("Continuing with default GPU settings...")

try:
    scene = bpy.context.scene
    eevee = scene.eevee
    
    # Configure Eevee quality settings optimized for GPU
    eevee.taa_render_samples = 64  # Good quality/speed balance
    eevee.taa_samples = 16  # Viewport samples
    eevee.use_gtao = True  # Ambient Occlusion
    eevee.gtao_distance = 0.2
    eevee.gtao_factor = 1.0
    eevee.gtao_quality = 0.25
    
    # Enable Screen Space Reflections
    eevee.use_ssr = True
    eevee.use_ssr_refraction = True
    eevee.ssr_quality = 0.25
    eevee.ssr_max_roughness = 0.5
    eevee.ssr_thickness = 0.2
    eevee.ssr_border_fade = 0.075
    eevee.ssr_firefly_fac = 10.0
    
    # Enable Bloom for better highlights
    eevee.use_bloom = True
    eevee.bloom_threshold = 0.8
    eevee.bloom_knee = 0.5
    eevee.bloom_radius = 6.5
    eevee.bloom_intensity = 0.05
    
    # Motion Blur settings
    eevee.use_motion_blur = False  # Disable for speed unless needed
    
    # Subsurface Scattering
    eevee.sss_samples = 7
    eevee.sss_jitter_threshold = 0.3
    
    # Volume settings optimized for GPU
    eevee.volumetric_start = 0.1
    eevee.volumetric_end = 100.0
    eevee.volumetric_tile_size = '8'
    eevee.volumetric_samples = 64
    eevee.volumetric_sample_distribution = 0.8
    eevee.use_volumetric_lights = True
    eevee.use_volumetric_shadows = False  # Disable for speed
    
    # GPU-optimized settings
    eevee.gi_diffuse_bounces = 3  # Reasonable bounce count for GPU
    eevee.gi_cubemap_resolution = '512'  # Good balance
    eevee.gi_visibility_resolution = '16'  # Performance setting
    
    print("✓ Eevee quality settings configured:")
    print(f"  - Render samples: {eevee.taa_render_samples}")
    print(f"  - Ambient Occlusion: {eevee.use_gtao}")
    print(f"  - Screen Space Reflections: {eevee.use_ssr}")
    print(f"  - Bloom: {eevee.use_bloom}")
    print(f"  - Motion Blur: {eevee.use_motion_blur}")
    
    # Configure render settings
    render = scene.render
    render.resolution_percentage = 100
    render.use_high_quality_normals = True
    
    # Film settings for better quality
    render.film_transparent = False  # Set to True if you need transparency
    render.filter_size = 1.5  # Anti-aliasing filter
    
    # Color management for better output
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    
    # Force viewport to use GPU shading
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == 'VIEW_3D':
                for space in area.spaces:
                    if space.type == 'VIEW_3D':
                        space.shading.type = 'MATERIAL'
                        if hasattr(space.shading, 'use_gpu_clip_planes'):
                            space.shading.use_gpu_clip_planes = True
    
    print("✓ Additional Eevee GPU optimizations applied")

except Exception as e:
    print(f"ERROR: Eevee configuration failed: {e}")
    import traceback
    traceback.print_exc()

# FINAL GPU VERIFICATION
print("\\n=== GPU VERIFICATION ===")
try:
    import gpu
    gpu_info = gpu.platform.renderer_get()
    print(f"GPU Renderer: {gpu_info}")
    
    prefs = bpy.context.preferences
    system = prefs.system
    print(f"GPU Backend: {system.gpu_backend}")
    print(f"Memory Cache: {system.memory_cache_limit}MB")
    print(f"GPU Memory Limit: {system.gpu_memory_limit}")
    
except Exception as e:
    print(f"GPU verification failed: {e}")

print("=== Eevee Next GPU configuration complete ===")
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
        
        // Create a temporary Python file with Eevee configuration
        const eeveePyPath = path.join(renderDir, "eevee_config.py");
        const createEeveeScript = author.Command("exec", {
            exe: "sh",
            args: ["-c", `cat > "${eeveePyPath}" << 'EOF'\n${eevee_script}\nEOF`]
        });
        task.addCommand(createEeveeScript);
        
        // Build command arguments in correct order per Blender documentation
        let args = [
            '-o', 
            path.join(renderDir, 'frame_'),
            '-F',
            settings.format,
            '--python',
            eeveePyPath,
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
            exeArgs: "-b -y -E BLENDER_EEVEE_NEXT",
            argsBefore: blender_args_before,
            blendfile: settings.blendfile,
            args: args,
            // CRITICAL: Add NVIDIA GPU environment variables for Eevee
            env: {
                "__NV_PRIME_RENDER_OFFLOAD": "1",
                "__GLX_VENDOR_LIBRARY_NAME": "nvidia",
                "NVIDIA_VISIBLE_DEVICES": "all",
                "NVIDIA_DRIVER_CAPABILITIES": "graphics,compute,utility",
                "CUDA_VISIBLE_DEVICES": "0"
            }
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