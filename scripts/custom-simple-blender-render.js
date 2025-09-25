// SPDX-License-Identifier: GPL-3.0-or-later

// 'use strict'

// exports.byteLength = byteLength
// exports.toByteArray = toByteArray
// exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

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

print("=== AGGRESSIVE CUDA GPU-ONLY Configuration ===")

# Set render engine to Cycles FIRST
bpy.context.scene.render.engine = 'CYCLES'
print(f"✓ Render engine set to: {bpy.context.scene.render.engine}")

# Get cycles preferences and configure CUDA with error handling
try:
    # Access Cycles addon preferences
    cycles_addon = bpy.context.preferences.addons.get('cycles')
    if not cycles_addon:
        print("ERROR: Cycles addon not found!")
        exit(1)
    
    prefs = cycles_addon.preferences
    print(f"Current compute device type: {prefs.compute_device_type}")
    
    # Force CUDA device type
    prefs.compute_device_type = 'CUDA'
    print("✓ Set compute device type to CUDA")
    
    # Refresh devices
    prefs.get_devices()
    print(f"Available devices after refresh: {len(prefs.devices)}")
    
    # AGGRESSIVE DEVICE MANAGEMENT
    cuda_devices = []
    cpu_devices = []
    other_devices = []
    
    # First pass: categorize devices
    for device in prefs.devices:
        if device.type == 'CUDA':
            cuda_devices.append(device)
        elif device.type == 'CPU':
            cpu_devices.append(device)
        else:
            other_devices.append(device)
    
    print(f"Found: {len(cuda_devices)} CUDA, {len(cpu_devices)} CPU, {len(other_devices)} other devices")
    
    # Second pass: DISABLE ALL NON-CUDA DEVICES
    for device in prefs.devices:
        device.use = (device.type == 'CUDA')
        status = "ENABLED" if device.use else "DISABLED"
        print(f"{status}: {device.type} - {device.name}")
    
    # Verify only CUDA devices are enabled
    enabled_devices = [d for d in prefs.devices if d.use]
    if not enabled_devices:
        print("ERROR: No devices enabled!")
        exit(1)
    
    if any(d.type != 'CUDA' for d in enabled_devices):
        print("ERROR: Non-CUDA devices still enabled!")
        for d in enabled_devices:
            if d.type != 'CUDA':
                print(f"  Still enabled: {d.type} - {d.name}")
        exit(1)
    
    print(f"✓ SUCCESS: Only {len(enabled_devices)} CUDA device(s) enabled")

except Exception as e:
    print(f"FATAL: CUDA device configuration failed: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# FORCE SCENE SETTINGS TO GPU
try:
    scene = bpy.context.scene
    cycles = scene.cycles
    
    # Set scene device to GPU
    cycles.device = 'GPU'
    print(f"✓ Scene cycles device: {cycles.device}")
    
    # Disable CPU fallback if available
    if hasattr(cycles, 'use_cpu_fallback'):
        cycles.use_cpu_fallback = False
        print("✓ CPU fallback disabled")
    
    # Set all view layers to GPU
    for i, view_layer in enumerate(scene.view_layers):
        if hasattr(view_layer, 'cycles'):
            view_layer.cycles.device = 'GPU'
            print(f"✓ View layer {i} '{view_layer.name}' set to GPU")
    
    # Additional Cycles performance settings for GPU
    cycles.use_denoising = False  # Disable denoising for pure GPU performance
    if hasattr(cycles, 'preview_samples'):
        cycles.preview_samples = 32  # Lower preview samples
    
    print("✓ Additional GPU optimizations applied")

except Exception as e:
    print(f"ERROR: Scene configuration failed: {e}")
    import traceback
    traceback.print_exc()

# FINAL VERIFICATION
print("\\n=== FINAL VERIFICATION ===")
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    enabled_cuda = [d for d in prefs.devices if d.use and d.type == 'CUDA']
    enabled_other = [d for d in prefs.devices if d.use and d.type != 'CUDA']
    
    print(f"Final enabled CUDA devices: {len(enabled_cuda)}")
    for d in enabled_cuda:
        print(f"  ✓ {d.name}")
    
    if enabled_other:
        print(f"ERROR: {len(enabled_other)} non-CUDA devices still enabled:")
        for d in enabled_other:
            print(f"  ✗ {d.type} - {d.name}")
        exit(1)
    
    print(f"Scene device: {bpy.context.scene.cycles.device}")
    print("=== GPU-ONLY CONFIGURATION COMPLETE ===")

except Exception as e:
    print(f"ERROR: Final verification failed: {e}")
    exit(1)
`.trim();

// Convert string to Uint8Array and encode with the proper base64 library
function stringToUint8Array(str) {
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    arr[i] = str.charCodeAt(i);
  }
  return arr;
}

// Base64 encode the script using the proper fromByteArray function
const cuda_script_b64 = fromByteArray(stringToUint8Array(cuda_script))
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
        
        // Create a temporary Python file with CUDA configuration
        const cudaPyPath = path.join(renderDir, "cuda_config.py");
        const createCudaScript = author.Command("exec", {
            exe: "sh",
            args: ["-c", `cat > "${cudaPyPath}" << 'EOF'\n${cuda_script}\nEOF`]
        });
        task.addCommand(createCudaScript);
        
        // Build command arguments in correct order per Blender documentation
        let args = [
            '-o', 
            path.join(renderDir, 'frame_'),
            '-F',
            settings.format,
            '--python',
            cudaPyPath,
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
