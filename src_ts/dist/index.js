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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSupportedModels = exports.UnsupportedParameterError = exports.UnsupportedOperationError = exports.ToolCallArgumentParseError = exports.EmptyResponseError = exports.AgentHubError = exports.AutoLLMClient = void 0;
var autoClient_1 = require("./autoClient");
Object.defineProperty(exports, "AutoLLMClient", { enumerable: true, get: function () { return autoClient_1.AutoLLMClient; } });
var errors_1 = require("./errors");
Object.defineProperty(exports, "AgentHubError", { enumerable: true, get: function () { return errors_1.AgentHubError; } });
Object.defineProperty(exports, "EmptyResponseError", { enumerable: true, get: function () { return errors_1.EmptyResponseError; } });
Object.defineProperty(exports, "ToolCallArgumentParseError", { enumerable: true, get: function () { return errors_1.ToolCallArgumentParseError; } });
Object.defineProperty(exports, "UnsupportedOperationError", { enumerable: true, get: function () { return errors_1.UnsupportedOperationError; } });
Object.defineProperty(exports, "UnsupportedParameterError", { enumerable: true, get: function () { return errors_1.UnsupportedParameterError; } });
var registry_1 = require("./registry");
Object.defineProperty(exports, "listSupportedModels", { enumerable: true, get: function () { return registry_1.listSupportedModels; } });
__exportStar(require("./types"), exports);
