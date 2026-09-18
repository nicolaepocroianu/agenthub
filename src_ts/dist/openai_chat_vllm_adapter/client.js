"use strict";
// Copyright 2025 Prism Shadow. and/or its affiliates
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenaiChatVllmAdapterClient = void 0;
const openai_chat_1 = require("../openai_chat");
const types_1 = require("../types");
// vLLM passes chat_template_kwargs straight to the served model's chat template, so the
// switch that turns thinking on is whatever that template happens to read. Each profile
// below maps an AgentHub level onto one family's kwargs; an empty mapping means the
// request carries no chat_template_kwargs at all.
//
// The upstream artifacts these profiles are read off, and the clamping those artifacts
// force, are snapshotted in llmsdk_docs/openai_chat_vllm_adapter/. Update that snapshot
// whenever a model is added here.
// Qwen3 templates read a single enable_thinking boolean and no effort key at all.
const QWEN3_THINKING = {
    [types_1.ThinkingLevel.NONE]: { enable_thinking: false },
    [types_1.ThinkingLevel.LOW]: { enable_thinking: true },
    [types_1.ThinkingLevel.MEDIUM]: { enable_thinking: true },
    [types_1.ThinkingLevel.HIGH]: { enable_thinking: true },
    [types_1.ThinkingLevel.XHIGH]: { enable_thinking: true },
    [types_1.ThinkingLevel.MAX]: { enable_thinking: true },
};
// Qwen3.8-27B and Qwen3.8-Flash-Next ship the same chat template, byte for byte, so they
// share a profile. It keeps enable_thinking as the off switch and takes its adaptive modes
// as reasoning_effort, validated against low/medium/xhigh, so high and max clamp to xhigh.
// The template defaults the key to xhigh, so a model on this template that is not sent the
// key runs every level at full effort.
const QWEN3_8_THINKING = {
    [types_1.ThinkingLevel.NONE]: { enable_thinking: false },
    [types_1.ThinkingLevel.LOW]: { reasoning_effort: "low" },
    [types_1.ThinkingLevel.MEDIUM]: { reasoning_effort: "medium" },
    [types_1.ThinkingLevel.HIGH]: { reasoning_effort: "xhigh" },
    [types_1.ThinkingLevel.XHIGH]: { reasoning_effort: "xhigh" },
    [types_1.ThinkingLevel.MAX]: { reasoning_effort: "xhigh" },
};
// DeepSeek V4 publishes no chat template; vLLM reads a thinking flag paired with
// reasoning_effort, and thinking is off whenever the flag is absent, which is what NONE
// sends. DeepSeek-V4-Pro and DeepSeek-V4-Flash share an encoding module that asserts
// reasoning_effort in ['max', None, 'high'], so low is a failed request rather than a
// weaker answer and high is the lowest value they take. That module then branches on 'max'
// alone, which means LOW through XHIGH all render the same prompt on these two models.
const DEEPSEEK_V4_PRO_FLASH_THINKING = {
    [types_1.ThinkingLevel.NONE]: {},
    [types_1.ThinkingLevel.LOW]: { thinking: true, reasoning_effort: "high" },
    [types_1.ThinkingLevel.MEDIUM]: { thinking: true, reasoning_effort: "high" },
    [types_1.ThinkingLevel.HIGH]: { thinking: true, reasoning_effort: "high" },
    [types_1.ThinkingLevel.XHIGH]: { thinking: true, reasoning_effort: "high" },
    [types_1.ThinkingLevel.MAX]: { thinking: true, reasoning_effort: "max" },
};
// DeepSeek-V4-Flash-Vision-Exp ships a different copy of that encoding module, one that
// validates reasoning_effort against a low/high/max table, so it keeps the finer scale;
// medium and xhigh clamp to high.
const DEEPSEEK_V4_VISION_EXP_THINKING = {
    [types_1.ThinkingLevel.NONE]: {},
    [types_1.ThinkingLevel.LOW]: { thinking: true, reasoning_effort: "low" },
    [types_1.ThinkingLevel.MEDIUM]: { thinking: true, reasoning_effort: "high" },
    [types_1.ThinkingLevel.HIGH]: { thinking: true, reasoning_effort: "high" },
    [types_1.ThinkingLevel.XHIGH]: { thinking: true, reasoning_effort: "high" },
    [types_1.ThinkingLevel.MAX]: { thinking: true, reasoning_effort: "max" },
};
// Keys are matched as substrings of the lowercased model id, so a served id keeps whatever
// prefix the deployment gave it (Qwen/Qwen3.6-35B-A3B, deepseek-ai/DeepSeek-V4-Pro). The
// first match wins, so a key that contains another must come first: deepseek-v4-flash is a
// prefix of deepseek-v4-flash-vision-exp.
const MODEL_THINKING_PROFILES = [
    ["qwen3.8-flash-next", QWEN3_8_THINKING],
    ["qwen3.8-27b", QWEN3_8_THINKING],
    ["qwen3.6-35b-a3b", QWEN3_THINKING],
    ["qwen3.5-0.8b", QWEN3_THINKING],
    ["qwen3.5-9b", QWEN3_THINKING],
    ["deepseek-v4-flash-vision-exp", DEEPSEEK_V4_VISION_EXP_THINKING],
    ["deepseek-v4-pro", DEEPSEEK_V4_PRO_FLASH_THINKING],
    ["deepseek-v4-flash", DEEPSEEK_V4_PRO_FLASH_THINKING],
];
/** Models served through vLLM's OpenAI-compatible Chat Completions API. */
class OpenaiChatVllmAdapterClient extends openai_chat_1.OpenaiChatClient {
    /**
     * Return the chat_template_kwargs this model's template reads for the level.
     *
     * A model outside the table falls back to Qwen3's enable_thinking, the most widespread
     * of the conventions and inert on a template that ignores the key.
     */
    _thinkingChatTemplateKwargs(thinkingLevel) {
        const model = this._model.toLowerCase();
        for (const [name, profile] of MODEL_THINKING_PROFILES) {
            if (model.includes(name)) {
                return { ...profile[thinkingLevel] };
            }
        }
        return { ...QWEN3_THINKING[thinkingLevel] };
    }
    /** Map AgentHub's level onto the thinking switch this model's chat template reads. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformUniConfigToModelConfig(config) {
        const vllmConfig = super.transformUniConfigToModelConfig(config);
        if (config.thinking_level !== undefined) {
            const chatTemplateKwargs = this._thinkingChatTemplateKwargs(config.thinking_level);
            if (Object.keys(chatTemplateKwargs).length > 0) {
                vllmConfig.chat_template_kwargs = chatTemplateKwargs;
            }
        }
        return vllmConfig;
    }
}
exports.OpenaiChatVllmAdapterClient = OpenaiChatVllmAdapterClient;
