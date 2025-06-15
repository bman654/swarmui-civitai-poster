console.log("Loading CivitAI Post Agent");

globalThis.civitPostAgentInitialized = undefined;

async function civitPostAgentSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function civitPostAgentWaitUntil(conditionFn) {
  const result = await conditionFn();
  if (result) {
    return result;
  }
  else {
    await civitPostAgentSleep(500);
    return await civitPostAgentWaitUntil(conditionFn);
  }
}
function civitPostAgentFindFileInput() {
  return civitPostAgentWaitUntil(() => document.querySelector('input[type="file"]'));
}

function civitPostAgentGetCivitSamplerName(sampler, scheduler) {
  switch (sampler) {
    case "euler":
      return "Euler";
    case "euler_ancestral":
      return "Euler a";
    case "lms":
      return "LMS" + (scheduler === "karras" ? " Karras" : "");
    case "dpm_2":
      return "DPM2" + (scheduler === "karras" ? " Karras" : "");
    case "dpm_2_ancestral" + (scheduler === "karras" ? " Karras" : ""):
      return "DPM2 a";
    case "dpm_fast":
      return "DPM fast";
    case "dpm_adaptive":
      return "DPM adaptive";
    case "dpmpp_2s_ancestral":
      return "DPM++ 2S a" + (scheduler === "karras" ? " Karras" : "");
    case "dpmpp_2m":
      return "DPM++ 2M" + (scheduler === "karras" ? " Karras" : "");
    case "huen":
      return "Huen";
    case "dpmpp_sde":
      return "DPM++ SDE" + (scheduler === "karras" ? " Karras" : "");
    case "dpmpp_2m_sde":
      return "DPM++ 2M SDE" + (scheduler === "karras" ? " Karras" : "");
    case "dpmpp_3m_sde":
      return "DPM++ 3M SDE" + (scheduler === "karras" ? " Karras" : scheduler === "exponential" ? " Exponential" : "");
    case "ddim":
      return "DDIM";
    case "lcm":
      return "LCM";
    case "uni_pc":
      return "UniPC";
    default:
      return "";
  }
}

function civitPostAgentGetPostInfoImage(postInfo, data) {
  const image = postInfo.images.find(image => image.name === data.imgUrl);
  if (!image) {
    throw new Error("Could not find image in postInfo");
  }
  return image;
}

async function fetchR(...args) {
  let count = 0;
  let response;
  do {
    response = await fetch(...args);
    if (!response.ok && (response.status !== 400) && count < 3) {
      count++;
      await civitPostAgentSleep(500 * count);
    }
  } while (!response.ok && count < 3);
  return response;
}

async function civitPostAgentAddResources(postInfo, data) {
  const image = civitPostAgentGetPostInfoImage(postInfo, data);
  for (let i = 0; i < data.modelInfo.length; i++) {
    if (i !== 0) {
      await civitPostAgentSleep(100);
    }
    try {
      if (data.models[i].param !== "model") {
        const modelInfo = data.modelInfo[i];
        if (modelInfo.modelVersionId) {
          const payload = {
            json: {
              id: [image.id],
              modelVersionId: 1 * modelInfo.modelVersionId,
              authed: true,
            }
          }

          const response = await fetchR("/api/trpc/post.addResourceToImage", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            mode: "cors",
            credentials: "same-origin",
          });

          if (!response.ok) {
            throw new Error("Failed to add resource to image");
          }
        }
      }
    } catch (e) {
      console.error(e);
      console.error("Failed to add resource to image: " + data.models[i].name);
    }
  }
}

async function civitPostAgentSetSwarmUITool(postInfo, data) {
  try {
    const image = civitPostAgentGetPostInfoImage(postInfo, data);
    const paramsPayload = {
      json: {
        data: [{
          imageId: image.id,
          toolId: 168
        }],
        authed: true,
      }
    }

    const response = await fetchR("/api/trpc/image.addTools", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paramsPayload),
      mode: "cors",
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("Failed to add SwarmUI tool");
    }
  } catch (e) {
    console.error(e);
    console.error("Failed to add SwarmUI tool");
  }
}

async function civitPostAgentSetImageMetadata(postInfo, data) {
  const image = civitPostAgentGetPostInfoImage(postInfo, data);
  const paramsPayload = {
    json: {
      id: image.id,
      meta: {
        seed: data.params.seed,
        steps: data.params.steps,
        prompt: data.params.prompt,
        negativePrompt: data.params.negativeprompt,
        cfgScale: data.params.cfgscale,
        sampler: civitPostAgentGetCivitSamplerName(data.params.sampler, data.params.scheduler),
      }
    }
  }
  const response = await fetchR("/api/trpc/post.updateImage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paramsPayload),
    mode: "cors",
    credentials: "same-origin",
  })
  if (!response.ok) {
    throw new Error("Failed to update image metadata");
  }
}

async function civitPostAgentGetPostInfo() {
  // window.location is something like https://civitai.com/posts/18283226/edit?modelId=1604653&modelVersionId=1815874&returnUrl=%2Fmodels%2F1604653%3FmodelVersionId%3D1815874
  // I need to pull out the postId
  const url = window.location.href;
  const postId = parseInt(url.match(/\/posts\/(\d+)/)[1], 10);
  console.log("Post ID:", postId);
  const input = JSON.stringify({
    json: {
      id: postId,
      authed: true
    }
  });
  const qs = new URLSearchParams({input}).toString();
  const response = await fetchR("/api/trpc/post.getEdit?" + qs, {
    headers: {
      "Content-Type": "application/json",
    },
    mode: "cors",
    credentials: "same-origin",
  });
  if (response.ok) {
    const json = await response.json();
    const postInfo = json.result.data.json;
    return postInfo;
    //const postId = postInfo.id;
    //const image0Id = postInfo.images[0].id;
    // images[0].name
  }
}

function civitPostAgentCreateDataTransferFromImages(data) {
  const baseName = data.imgUrl;
  const ext = data.imgUrl.split('.').pop().toLowerCase();
  console.log("Base name:", baseName, "Ext:", ext);

  // Get the base64 string
  const base64ImageData = data.imageData;

  // Convert base64 to binary data
  // First, remove the data URL prefix if it exists
  const base64Content = base64ImageData.includes('base64,')
    ? base64ImageData.split('base64,')[1]
    : base64ImageData;

  // Decode base64 to binary
  const binaryString = atob(base64Content);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  // Convert binary string to byte array
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create a DataTransfer and add a File created directly from the Uint8Array
  const dataTransfer = new DataTransfer();
  const fileType = ext === 'jpg' ? 'image/jpeg' : 'image/png';
  dataTransfer.items.add(new File([bytes], baseName, {type: fileType}));
  return dataTransfer;
}

async function civitPostAgentAddAllImageInfo(data) {
  const postInfo = await civitPostAgentGetPostInfo();
  await civitPostAgentSleep(100)
  await civitPostAgentSetImageMetadata(postInfo, data);
  await civitPostAgentSleep(100)
  await civitPostAgentAddResources(postInfo, data);
  await civitPostAgentSleep(100)
  await civitPostAgentSetSwarmUITool(postInfo, data);
}

async function civitPostAgentEditPostAddImage(data) {
  // try to stop the stupid warning on reload
  window.addEventListener('beforeunload', window.onbeforeunload = e => {
    e.stopImmediatePropagation();
    e.defaultPrevented = false;
    return e.returnValue = false;
  }, true);

  try {
    await civitPostAgentWaitUntil(() => globalThis.civitPostAgentInitialized);
    const dropZone = await civitPostAgentWaitUntil(() => document.querySelector('div.mantine-Dropzone-root'));
    console.log("Found dropZone:", dropZone);


    const dataTransfer = civitPostAgentCreateDataTransferFromImages(data);
    console.log("Dispatching drop event");
    const dropEvent = new DragEvent("drop", {
      dataTransfer: dataTransfer,
      bubbles: true,
      cancelable: true,
    });
    dropZone.dispatchEvent(dropEvent);

    console.log("Waiting for url to change");
    // wait for url to look like https://civitai.com/posts/18283226/edit...
    await civitPostAgentWaitUntil(() => /^https:\/\/civitai\.com\/posts\/\d+\/edit/.test(window.location.href));
    console.log("waiting for image to be added")
    let postInfo;
    await civitPostAgentWaitUntil(async () => {
      postInfo = await civitPostAgentGetPostInfo();
      try {
        return await civitPostAgentGetPostInfoImage(postInfo, data);
      } catch (e) {
        return false;
      }
    });

    console.log("Image added");

    // now add all the image info
    await civitPostAgentAddAllImageInfo(data);

  } catch (e) {
    alert(`Error setting image metadata: ${e}`);
    console.error(e);
  }

  // try to stop the stupid warning on reload
  window.addEventListener('beforeunload', window.onbeforeunload = e => {
    e.stopImmediatePropagation();
    e.defaultPrevented = false;
    return e.returnValue = false;
  }, true);

  // tell the extension we're done
  return window.location.href;
}

function civitPostAgentInit() {
  globalThis.civitPostAgentInitialized = true;
}

if (document.readyState  === "loading") {
  // Run when the page loads
  console.log("Waiting for DOMContentLoaded", document.readyState);
  document.addEventListener('DOMContentLoaded', civitPostAgentInit);
} else {
  console.log("DOMContentLoaded already fired");
  // Also run now in case DOMContentLoaded already fired
  civitPostAgentInit();
}
