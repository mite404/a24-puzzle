"use client";

const URLCache = new Map<string, string>();

async function addWorkletModule(
  worklet: AudioWorklet,
  name: string,
  sourceCode: string,
): Promise<void> {
  const cachedUrl = URLCache.get(name);
  if (cachedUrl) {
    await worklet.addModule(cachedUrl);
    return;
  }

  const blob = new Blob([sourceCode], { type: "application/javascript" });
  const blobURL = URL.createObjectURL(blob);
  try {
    await worklet.addModule(blobURL);
    URLCache.set(name, blobURL);
    return;
  } catch {
    URL.revokeObjectURL(blobURL);
  }

  const base64 = btoa(sourceCode);
  const moduleURL = `data:application/javascript;base64,${base64}`;
  await worklet.addModule(moduleURL);
  URLCache.set(name, moduleURL);
}

/** PCM16 worklet — same logic as @elevenlabs/client scribeAudioProcessor. */
const SCRIBE_AUDIO_PROCESSOR_SOURCE = `\
class ScribeAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.bufferSize = 4096;
    this.inputSampleRate = null;
    this.outputSampleRate = null;
    this.resampleRatio = 1;
    this.lastSample = 0;
    this.resampleAccumulator = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === "configure") {
        this.inputSampleRate = data.inputSampleRate;
        this.outputSampleRate = data.outputSampleRate;
        if (this.inputSampleRate && this.outputSampleRate) {
          this.resampleRatio = this.inputSampleRate / this.outputSampleRate;
        }
      }
    };
  }
  resample(inputData) {
    if (this.resampleRatio === 1 || !this.inputSampleRate) return inputData;
    const outputSamples = [];
    for (let i = 0; i < inputData.length; i++) {
      const currentSample = inputData[i];
      while (this.resampleAccumulator < 1) {
        const interpolated =
          this.lastSample +
          (currentSample - this.lastSample) * this.resampleAccumulator;
        outputSamples.push(interpolated);
        this.resampleAccumulator += this.resampleRatio;
      }
      this.resampleAccumulator -= 1;
      this.lastSample = currentSample;
    }
    return new Float32Array(outputSamples);
  }
  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      let channelData = input[0];
      if (this.resampleRatio !== 1) channelData = this.resample(channelData);
      for (let i = 0; i < channelData.length; i++) this.buffer.push(channelData[i]);
      if (this.buffer.length >= this.bufferSize) {
        const float32Array = new Float32Array(this.buffer);
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
          const sample = Math.max(-1, Math.min(1, float32Array[i]));
          int16Array[i] = sample < 0 ? sample * 32768 : sample * 32767;
        }
        this.port.postMessage({ audioData: int16Array.buffer }, [int16Array.buffer]);
        this.buffer = [];
      }
    }
    return true;
  }
}
registerProcessor("scribeAudioProcessor", ScribeAudioProcessor);
`;

export async function loadScribeAudioProcessor(
  worklet: AudioWorklet,
): Promise<void> {
  await addWorkletModule(worklet, "scribeAudioProcessor", SCRIBE_AUDIO_PROCESSOR_SOURCE);
}
