#!/usr/bin/with-contenv bash

# LinuxServer custom init script for OptiX fix
echo "**** Setting up OptiX support ****"

# Fix OptiX symlink issue for NVIDIA_DRIVER_CAPABILITIES=graphics
if [ -f /usr/lib/x86_64-linux-gnu/libnvoptix.so.1 ] && [ ! -s /usr/lib/x86_64-linux-gnu/libnvoptix.so.1 ]; then
    echo "Fixing OptiX symlink..."
    OPTIX_LIB=$(ls /usr/lib/x86_64-linux-gnu/libnvoptix.so.* 2>/dev/null | grep -v ".1$" | head -1)
    if [ -n "$OPTIX_LIB" ]; then
        ln -sf "$OPTIX_LIB" /usr/lib/x86_64-linux-gnu/libnvoptix.so.1
        echo "OptiX symlink fixed: $OPTIX_LIB -> libnvoptix.so.1"
        
        # Also fix rtcore if needed
        RTCORE_LIB=$(ls /usr/lib/x86_64-linux-gnu/libnvidia-rtcore.so.* 2>/dev/null | head -1)
        if [ -n "$RTCORE_LIB" ] && [ -f /usr/lib/x86_64-linux-gnu/libnvidia-rtcore.so ]; then
            if [ ! -s /usr/lib/x86_64-linux-gnu/libnvidia-rtcore.so ]; then
                ln -sf "$RTCORE_LIB" /usr/lib/x86_64-linux-gnu/libnvidia-rtcore.so
                echo "RTCORE symlink fixed: $RTCORE_LIB -> libnvidia-rtcore.so"
            fi
        fi
        
        echo "OptiX should now be available for Blender!"
    else
        echo "No OptiX library found, using CUDA fallback"
    fi
else
    echo "OptiX symlink appears to be working or not present"
fi

# List available OptiX libraries for debugging
echo "Available OptiX libraries:"
ls -la /usr/lib/x86_64-linux-gnu/libnvoptix* 2>/dev/null || echo "No OptiX libraries found"

echo "**** OptiX setup complete ****"