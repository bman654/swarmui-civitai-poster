/* This script runs in the context of the SwarmUI UI...thus has access to the global "let" variables and methods */
(async () => {
  if (!globalThis.extSwarmAgentModelInfoCache) {
    class ExtSwarmAgentAsyncCache {
      #cache = {};
      #factory;
      #maxAge;

      constructor(factory, maxAge) {
        this.#factory = factory
        this.#maxAge = maxAge
      }

      get(key) {
        const cached = this.#cache[key]
        if (cached) {
          return cached
        }

        const p = this.#factory(key)
        this.#cache[key] = p

        // remove it from the cache if it fails, or after max_age time if it succeeds
        p.then(
          () => {
            if (this.#maxAge > 0) {
              setTimeout(() => delete this.#cache[key], this.#maxAge)
            }
          },
          () => delete this.#cache[key]
        )

        return p
      }
    }

    globalThis.extSwarmAgentModelInfoCache = new ExtSwarmAgentAsyncCache(modelHash => {
      return new Promise((resolve, reject) => {
        modelDownloader.searchCivitaiForHash(modelHash, result => {
          if (!result) {
            return resolve({});
          }

          // parse "https://civitai.com/models/1604653?modelVersionId=1815874" into modelId and modelVersionId
          const modelId = result.match(/\/models\/(\d+)/)[1];
          const modelVersionId = result.match(/modelVersionId=(\d+)/)[1];
          return resolve({modelId, modelVersionId, url: result});
        })
      })
    }, 1000 * 60 * 60) // cache for 1 hour
  }

  async function extSwarmAgentGetImageData(imgUrl) {
    // Fetch the image and convert it to base64 format
    const response = await fetch(imgUrl);
    const blob = await response.blob();
    const reader = new FileReader();

    // Convert blob to base64 string
    const imageDataBase64 = await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    return imageDataBase64
  }

  async function extSwarmAgentGetImageInfo() {
    const imgUrl = currentImgSrc;

    if (!imgUrl.toLowerCase().endsWith(".png") && !imgUrl.toLowerCase().endsWith(".jpg")) {
      throw new Error("This extension currently only supports PNG and JPG images");
    }

    const metadata = JSON.parse(interpretMetadata(currentMetadataVal));
    const {
      steps,
      cfgscale,
      prompt = "",
      negativeprompt = "",
      sampler,
      scheduler,
      seed,
      loras = [],
      loraweights = [],
      preview_notice
    } = metadata.sui_image_params;

    if (preview_notice) {
      throw new Error(preview_notice);
    }

    const models = metadata.sui_models;
    const modelInfo = [];
    for (const model of models) {
      const info = await globalThis.extSwarmAgentModelInfoCache.get(model.hash);
      modelInfo.push(info);
    }

    const mainModelIndex = models.findIndex(model => model.param === "model")
    if (mainModelIndex === -1 || !modelInfo[mainModelIndex].url) {
      throw new Error('Main model not found');
    }

    const payload = {
      modelInfo,
      models,
      loras,
      loraweights,
      imageData: await extSwarmAgentGetImageData(imgUrl),
      imgUrl,
      params: {
        seed,
        steps,
        cfgscale,
        prompt,
        negativeprompt,
        sampler,
        scheduler,
      }
    }

    return payload;
  }

  try {
    return await extSwarmAgentGetImageInfo();
  }
  catch (err) {
    alert(`Unable to post image to CivitAI: ${err}`);
  }
})();
