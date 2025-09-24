// Test script to check what GPU devices are available in BlenderProc
const JOB_TYPE = {
    label: "Test GPU Devices Available",
    description: "Test what GPU devices are detected by Blender",
    settings: [
        { key: "blendfile", type: "string", required: false, description: "Not used - will use factory startup", visible: "web" },
    ]
};

const test_gpu_devices = `
import bpy

print("=== Testing GPU Device Detection ===")

# Get cycles preferences
prefs = bpy.context.preferences.addons['cycles'].preferences

# Test different compute device types
device_types = ['CUDA', 'OPTIX', 'OPENCL', 'HIP']

for device_type in device_types:
    print(f"\\n--- Testing {device_type} ---")
    try:
        prefs.compute_device_type = device_type
        prefs.get_devices()
        
        devices = [d for d in prefs.devices if d.type == device_type]
        if devices:
            print(f"✓ {device_type} devices found:")
            for device in devices:
                print(f"  - {device.name} (ID: {device.id})")
        else:
            print(f"✗ No {device_type} devices found")
    except Exception as e:
        print(f"✗ Error testing {device_type}: {e}")

print("\\n=== All Available Devices ===")
# Reset to CUDA and list all devices
prefs.compute_device_type = 'CUDA'
prefs.get_devices()

for device in prefs.devices:
    print(f"Device: {device.name} | Type: {device.type} | ID: {device.id}")

print(f"\\n=== Blender Version Info ===")
print(f"Blender version: {bpy.app.version_string}")
print(f"Cycles version: {bpy.app.version}")
`;

function compileJob(job) {
    print("GPU Device Test job submitted");
    
    const task = author.Task("test-gpu-devices", "blender");
    
    // Use exec command instead to run blender directly
    const command = author.Command("exec", {
        exe: "{blender}",
        args: [
            "-b", "-y", "--factory-startup",
            "--python-expr", test_gpu_devices
        ]
    });
    
    task.addCommand(command);
    job.addTask(task);
}