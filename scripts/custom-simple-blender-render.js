// SPDX-License-Identifier: GPL-3.0-or-later

const JOB_TYPE = {
    label: "Simple Blender Render (No Video)",
    description: "Render a sequence of frames without creating preview video",
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
    print("Blender Render job submitted (No Video)");
    print("job: ", job);

    const settings = job.settings;
    const renderOutput = renderOutputPath(job);

    // Make sure that when the job is investigated later, it shows the
    // actually-used render output:
    settings.render_output_path = renderOutput;

    const renderDir = path.dirname(renderOutput);
    const renderTasks = authorRenderTasks(settings, renderDir, renderOutput);

    for (const rt of renderTasks) {
        job.addTask(rt);
    }
}

// Do field replacement on the render output path.
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

function authorRenderTasks(settings, renderDir, renderOutput) {
    print("authorRenderTasks(", renderDir, renderOutput, ")");
    let renderTasks = [];
    let chunks = frameChunker(settings.frames, settings.chunk_size);

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
        
        // Parse the chunk format (e.g., "1-500", "501-1000")
        const frameRange = chunk.split("-");
        const startFrame = frameRange[0];
        const endFrame = frameRange[1] || frameRange[0];
        
        const command = author.Command("blender-render", {
            exe: "{blender}",
            exeArgs: "{blenderArgs}",
            argsBefore: [],
            blendfile: settings.blendfile,
            args: baseArgs.concat([
                "-o", renderOutput,
                "--render-format", settings.format,
                "-f", startFrame + ".." + endFrame,
            ]),
            env: {
                "CYCLES_DEVICE": "CUDA",
                "CUDA_VISIBLE_DEVICES": "0"
            }
        });
        task.addCommand(command);
        renderTasks.push(task);
    }
    return renderTasks;
}
