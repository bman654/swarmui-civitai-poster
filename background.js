// background.js - Background service worker for the Chrome extension

chrome.runtime.onInstalled.addListener(() => {
  // Page actions are disabled by default and enabled on select tabs
  chrome.action.disable();

  // Clear all rules to ensure only our expected rules are set
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    // Declare a rule to enable the action on example.com pages
    let swarmUIRule = {
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {pathPrefix: '/Text2Image'},
          css: ['div.current-image-buttons']
        })
      ],
      actions: [new chrome.declarativeContent.ShowAction()],
    };

    // Finally, apply our new array of rules
    let rules = [swarmUIRule];
    chrome.declarativeContent.onPageChanged.addRules(rules);
  });
});

let promiseChain = Promise.resolve({});

async function getTabToUse(prevJob, modelId, modelVersionId, newTabUrl, tabIndex) {
  try {
    const tab = prevJob.civitTabId ? await chrome.tabs.get(prevJob.civitTabId) : undefined;
    console.log("checking old tab", !!tab, tab?.pendingUrl, tab?.url, prevJob.civitTabId, prevJob.url, prevJob.url === tab?.url, prevJob.modelId === modelId, prevJob.modelVersionId === modelVersionId);
    if (prevJob.modelId === modelId && prevJob.modelVersionId === modelVersionId && tab && tab.url === prevJob.url) {
      // re-use the tab.  Make it active then return it
      console.log("Re-using tab:", tab.id);
      await chrome.tabs.update(tab.id, {
        active: true,
      });
      return tab;
    }
  }
  catch (e) {
    console.warn(e);
  }

  // create a new tab
  console.log("Creating new tab:", newTabUrl);
  return await chrome.tabs.create({
    url: newTabUrl,
    index: tabIndex,
  });
  console.log("Done creating new tab");
}

function queuePostJob(modelId, modelVersionId, payload, tabIndex) {
  async function postToCivitAi(prevJob) {
    const url = `https://civitai.com/posts/create?modelId=${modelId}&modelVersionId=${modelVersionId}&returnUrl=%2Fmodels%2F${modelId}%3FmodelVersionId%3D${modelVersionId}`;
    const tab = await getTabToUse(prevJob, modelId, modelVersionId, url, tabIndex);

    console.log("Injecting agent into tab:", tab.id, "url:", tab.url, "modelId:", modelId, "modelVersionId:", modelVersionId);
    // inject the agent script into the tab
    await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      files: ['civitai-post-agent.js'],
      world: 'MAIN',
    });

    console.log("Executing agent script in tab:", tab.id, "url:", tab.url, "modelId:", modelId, "modelVersionId:", modelVersionId);
    // send the image data to the agent
    const postEditUrl = await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      world: 'MAIN',
      func: (data) => civitPostAgentEditPostAddImage(data),
      args: [payload],
    });

    // reload the page so it can pick up all the changes we made behind its back
    console.log("Reloading tab:", tab.id, "url:", tab.url, "modelId:", modelId, "modelVersionId:", modelVersionId);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await chrome.tabs.reload(tab.id);

    console.log("Done with job");
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      civitTabId: tab.id,
      url: postEditUrl[0].result,
      modelId,
      modelVersionId
    }
  }

  promiseChain = promiseChain.then(postToCivitAi).catch(error => {
    console.error(error);
    return {};
  });
}

// Listen for clicks on the action icon
chrome.action.onClicked.addListener(async (tab) => {
  const [{result: payload}] = await chrome.scripting.executeScript({
    target: {tabId: tab.id},
    files: ['swarm-get-image-info.js'],
    world: 'MAIN',
  });

  if (payload) {
    // construct the URL we want to open
    const modelIndex = payload.models.findIndex(model => model.param === "model");
    const modelInfo = payload.modelInfo[modelIndex];
    const modelId = modelInfo.modelId;
    const modelVersionId = modelInfo.modelVersionId;
    queuePostJob(modelId, modelVersionId, payload, tab.index + 1);
  }
});
