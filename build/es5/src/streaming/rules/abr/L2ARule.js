'use strict';Object.defineProperty(exports,"__esModule",{value:true});var _MetricsConstants=require('../../constants/MetricsConstants');var _MetricsConstants2=_interopRequireDefault(_MetricsConstants);var _SwitchRequest=require('../SwitchRequest');var _SwitchRequest2=_interopRequireDefault(_SwitchRequest);var _FactoryMaker=require('../../../core/FactoryMaker');var _FactoryMaker2=_interopRequireDefault(_FactoryMaker);var _HTTPRequest=require('../../vo/metrics/HTTPRequest');var _EventBus=require('../../../core/EventBus');var _EventBus2=_interopRequireDefault(_EventBus);var _Events=require('../../../core/events/Events');var _Events2=_interopRequireDefault(_Events);var _Debug=require('../../../core/Debug');var _Debug2=_interopRequireDefault(_Debug);var _Constants=require('../../constants/Constants');var _Constants2=_interopRequireDefault(_Constants);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2020, Unified Streaming.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */// For a description of the Learn2Adapt-LowLatency (L2A-LL) bitrate adaptation algorithm, see https://github.com/unifiedstreaming/Learn2Adapt-LowLatency/blob/master/Online_learning_for_bitrate_adaptation_in_low_latency_live_streaming_CR.pdf
var L2A_STATE_ONE_BITRATE=0;// If there is only one bitrate (or initialization failed), always return NO_CHANGE.
var L2A_STATE_STARTUP=1;// Set placeholder buffer such that we download fragments at most recently measured throughput.
var L2A_STATE_STEADY=2;// Buffer primed, we switch to steady operation.
function L2ARule(config){config=config||{};var context=this.context;var dashMetrics=config.dashMetrics;var eventBus=(0,_EventBus2.default)(context).getInstance();var instance=void 0,l2AStateDict=void 0,l2AParameterDict=void 0,logger=void 0;/**
     * Setup function to initialize L2ARule
     */function setup(){logger=(0,_Debug2.default)(context).getInstance().getLogger(instance);_resetInitialSettings();eventBus.on(_Events2.default.PLAYBACK_SEEKING,_onPlaybackSeeking,instance);eventBus.on(_Events2.default.MEDIA_FRAGMENT_LOADED,_onMediaFragmentLoaded,instance);eventBus.on(_Events2.default.METRIC_ADDED,_onMetricAdded,instance);eventBus.on(_Events2.default.QUALITY_CHANGE_REQUESTED,_onQualityChangeRequested,instance);}/**
     * Sets the initial state of the algorithm. Calls the initialize function for the paramteters.
     * @param {object} rulesContext
     * @return {object} initialState
     * @private
     */function _getInitialL2AState(rulesContext){var initialState={};var mediaInfo=rulesContext.getMediaInfo();var bitrates=mediaInfo.bitrateList.map(function(b){return b.bandwidth/1000;});initialState.state=L2A_STATE_STARTUP;initialState.bitrates=bitrates;initialState.lastQuality=0;_initializeL2AParameters(mediaInfo);_clearL2AStateOnSeek(initialState);return initialState;}/**
     * Initializes the parameters of the algorithm. This will be done once for each media type.
     * @param {object} mediaInfo
     * @private
     */function _initializeL2AParameters(mediaInfo){if(!mediaInfo||!mediaInfo.type){return;}l2AParameterDict[mediaInfo.type]={};l2AParameterDict[mediaInfo.type].w=[];//Vector of probabilities associated with bitrate decisions
l2AParameterDict[mediaInfo.type].prev_w=[];//Vector of probabilities associated with bitrate decisions calculated in the previous step
l2AParameterDict[mediaInfo.type].Q=0;//Initialization of Lagrangian multiplier (This keeps track of the buffer displacement)
l2AParameterDict[mediaInfo.type].segment_request_start_s=0;l2AParameterDict[mediaInfo.type].segment_download_finish_s=0;l2AParameterDict[mediaInfo.type].B_target=1.5;//Target buffer level
}/**
     * Clears the state object
     * @param {object} l2AState
     * @private
     */function _clearL2AStateOnSeek(l2AState){l2AState.placeholderBuffer=0;l2AState.mostAdvancedSegmentStart=NaN;l2AState.lastSegmentWasReplacement=false;l2AState.lastSegmentStart=NaN;l2AState.lastSegmentDurationS=NaN;l2AState.lastSegmentRequestTimeMs=NaN;l2AState.lastSegmentFinishTimeMs=NaN;}/**
     * Returns the state object for a fiven media type. If the state object is not yet defined _getInitialL2AState is called
     * @param {object} rulesContext
     * @return {object} l2AState
     * @private
     */function _getL2AState(rulesContext){var mediaType=rulesContext.getMediaType();var l2AState=l2AStateDict[mediaType];if(!l2AState){l2AState=_getInitialL2AState(rulesContext);l2AStateDict[mediaType]=l2AState;}return l2AState;}/**
     * Event handler for the seeking event.
     * @private
     */function _onPlaybackSeeking(){for(var mediaType in l2AStateDict){if(l2AStateDict.hasOwnProperty(mediaType)){var l2aState=l2AStateDict[mediaType];if(l2aState.state!==L2A_STATE_ONE_BITRATE){l2aState.state=L2A_STATE_STARTUP;_clearL2AStateOnSeek(l2aState);}}}}/**
     * Event handler for the mediaFragmentLoaded event
     * @param {object} e
     * @private
     */function _onMediaFragmentLoaded(e){if(e&&e.chunk&&e.chunk.mediaInfo){var l2AState=l2AStateDict[e.chunk.mediaInfo.type];var l2AParameters=l2AParameterDict[e.chunk.mediaInfo.type];if(l2AState&&l2AState.state!==L2A_STATE_ONE_BITRATE){var start=e.chunk.start;if(isNaN(l2AState.mostAdvancedSegmentStart)||start>l2AState.mostAdvancedSegmentStart){l2AState.mostAdvancedSegmentStart=start;l2AState.lastSegmentWasReplacement=false;}else{l2AState.lastSegmentWasReplacement=true;}l2AState.lastSegmentStart=start;l2AState.lastSegmentDurationS=e.chunk.duration;l2AState.lastQuality=e.chunk.quality;_checkNewSegment(l2AState,l2AParameters);}}}/**
     * Event handler for the metricAdded event
     * @param {object} e
     * @private
     */function _onMetricAdded(e){if(e&&e.metric===_MetricsConstants2.default.HTTP_REQUEST&&e.value&&e.value.type===_HTTPRequest.HTTPRequest.MEDIA_SEGMENT_TYPE&&e.value.trace&&e.value.trace.length){var l2AState=l2AStateDict[e.mediaType];var l2AParameters=l2AParameterDict[e.mediaType];if(l2AState&&l2AState.state!==L2A_STATE_ONE_BITRATE){l2AState.lastSegmentRequestTimeMs=e.value.trequest.getTime();l2AState.lastSegmentFinishTimeMs=e.value._tfinish.getTime();_checkNewSegment(l2AState,l2AParameters);}}}/**
     * When a new metric has been added or a media fragment has been loaded the state is adjusted accordingly
     * @param {object} L2AState
     * @param {object} l2AParameters
     * @private
     */function _checkNewSegment(L2AState,l2AParameters){if(!isNaN(L2AState.lastSegmentStart)&&!isNaN(L2AState.lastSegmentRequestTimeMs)){l2AParameters.segment_request_start_s=0.001*L2AState.lastSegmentRequestTimeMs;l2AParameters.segment_download_finish_s=0.001*L2AState.lastSegmentFinishTimeMs;L2AState.lastSegmentStart=NaN;L2AState.lastSegmentRequestTimeMs=NaN;}}/**
     * Event handler for the qualityChangeRequested event
     * @param {object} e
     * @private
     */function _onQualityChangeRequested(e){// Useful to store change requests when abandoning a download.
if(e&&e.mediaType){var L2AState=l2AStateDict[e.mediaType];if(L2AState&&L2AState.state!==L2A_STATE_ONE_BITRATE){L2AState.abrQuality=e.newQuality;}}}/**
     * Dot multiplication of two arrays
     * @param {array} arr1
     * @param {array} arr2
     * @return {number} sumdot
     * @private
     */function _dotmultiplication(arr1,arr2){if(arr1.length!==arr2.length){return-1;}var sumdot=0;for(var i=0;i<arr1.length;i++){sumdot=sumdot+arr1[i]*arr2[i];}return sumdot;}/**
     * Project an n-dim vector y to the simplex Dn
     * Dn = { x : x n-dim, 1 >= x >= 0, sum(x) = 1}
     * Algorithm is explained at http://arxiv.org/abs/1101.6081
     * @param {array} arr
     * @return {array}
     */function euclideanProjection(arr){var m=arr.length;var bget=false;var arr2=[];for(var ii=0;ii<m;++ii){arr2[ii]=arr[ii];}var s=arr.sort(function(a,b){return b-a;});var tmpsum=0;var tmax=0;var x=[];for(var _ii=0;_ii<m-1;++_ii){tmpsum=tmpsum+s[_ii];tmax=(tmpsum-1)/(_ii+1);if(tmax>=s[_ii+1]){bget=true;break;}}if(!bget){tmax=(tmpsum+s[m-1]-1)/m;}for(var _ii2=0;_ii2<m;++_ii2){x[_ii2]=Math.max(arr2[_ii2]-tmax,0);}return x;}/**
     * Returns a switch request object indicating which quality is to be played
     * @param {object} rulesContext
     * @return {object}
     */function getMaxIndex(rulesContext){var switchRequest=(0,_SwitchRequest2.default)(context).create();var horizon=4;// Optimization horizon (The amount of steps required to achieve convergence)
var vl=Math.pow(horizon,0.99);// Cautiousness parameter, used to control aggressiveness of the bitrate decision process.
var alpha=Math.max(Math.pow(horizon,1),vl*Math.sqrt(horizon));// Step size, used for gradient descent exploration granularity
var mediaInfo=rulesContext.getMediaInfo();var mediaType=rulesContext.getMediaType();var bitrates=mediaInfo.bitrateList.map(function(b){return b.bandwidth;});var bitrateCount=bitrates.length;var scheduleController=rulesContext.getScheduleController();var streamInfo=rulesContext.getStreamInfo();var abrController=rulesContext.getAbrController();var throughputHistory=abrController.getThroughputHistory();var isDynamic=streamInfo&&streamInfo.manifestInfo&&streamInfo.manifestInfo.isDynamic;var useL2AABR=rulesContext.useL2AABR();var bufferLevel=dashMetrics.getCurrentBufferLevel(mediaType,true);var safeThroughput=throughputHistory.getSafeAverageThroughput(mediaType,isDynamic);var throughput=throughputHistory.getAverageThroughput(mediaType,isDynamic);// In kbits/s
var react=2;// Reactiveness to volatility (abrupt throughput drops), used to re-calibrate Lagrangian multiplier Q
var latency=throughputHistory.getAverageLatency(mediaType);var videoModel=rulesContext.getVideoModel();var quality=void 0;var currentPlaybackRate=videoModel.getPlaybackRate();if(!rulesContext||!rulesContext.hasOwnProperty('getMediaInfo')||!rulesContext.hasOwnProperty('getMediaType')||!rulesContext.hasOwnProperty('getScheduleController')||!rulesContext.hasOwnProperty('getStreamInfo')||!rulesContext.hasOwnProperty('getAbrController')||!rulesContext.hasOwnProperty('useL2AABR')){return switchRequest;}switchRequest.reason=switchRequest.reason||{};if(!useL2AABR||mediaType===_Constants2.default.AUDIO){// L2A decides bitrate only for video. Audio to be included in decision process in a later stage
return switchRequest;}scheduleController.setTimeToLoadDelay(0);var l2AState=_getL2AState(rulesContext);if(l2AState.state===L2A_STATE_ONE_BITRATE){// shouldn't even have been called
return switchRequest;}var l2AParameter=l2AParameterDict[mediaType];if(!l2AParameter){return switchRequest;}switchRequest.reason.state=l2AState.state;switchRequest.reason.throughput=throughput;switchRequest.reason.latency=latency;if(isNaN(throughput)){// still starting up - not enough information
return switchRequest;}switch(l2AState.state){case L2A_STATE_STARTUP:quality=abrController.getQualityForBitrate(mediaInfo,safeThroughput,latency);//During strat-up phase abr.controller is responsible for bitrate decisions.
switchRequest.quality=quality;switchRequest.reason.throughput=safeThroughput;l2AState.lastQuality=quality;if(!isNaN(l2AState.lastSegmentDurationS)&&bufferLevel>=l2AParameter.B_target){l2AState.state=L2A_STATE_STEADY;l2AParameter.Q=vl;// Initialization of Q langrangian multiplier
// Update of probability vector w, to be used in main adaptation logic of L2A below (steady state)
for(var i=0;i<bitrateCount;++i){if(i===l2AState.lastQuality){l2AParameter.prev_w[i]=1;}else{l2AParameter.prev_w[i]=0;}}}break;// L2A_STATE_STARTUP
case L2A_STATE_STEADY:var diff1=[];//Used to calculate the difference between consecutive decisions (w-w_prev)
// Manual calculation of latency and throughput during previous request
var throughputMeasureTime=dashMetrics.getCurrentHttpRequest(mediaType).trace.reduce(function(a,b){return a+b.d;},0);var downloadBytes=dashMetrics.getCurrentHttpRequest(mediaType).trace.reduce(function(a,b){return a+b.b[0];},0);var lastthroughput=Math.round(8*downloadBytes/throughputMeasureTime);// bits/ms = kbits/s
if(lastthroughput<1){lastthroughput=1;}//To avoid division with 0 (avoid infinity) in case of an absolute network outage
var V=l2AState.lastSegmentDurationS;var sign=1;//Main adaptation logic of L2A-LL
for(var _i=0;_i<bitrateCount;++_i){bitrates[_i]=bitrates[_i]/1000;// Originally in bps, now in Kbps
if(currentPlaybackRate*bitrates[_i]>lastthroughput){// In this case buffer would deplete, leading to a stall, which increases latency and thus the particular probability of selsection of bitrate[i] should be decreased.
sign=-1;}// The objective of L2A is to minimize the overall latency=request-response time + buffer length after download+ potential stalling (if buffer less than chunk downlad time)
l2AParameter.w[_i]=l2AParameter.prev_w[_i]+sign*(V/(2*alpha))*((l2AParameter.Q+vl)*(currentPlaybackRate*bitrates[_i]/lastthroughput));//Lagrangian descent
}// Apply euclidean projection on w to ensure w expresses a probability distribution
l2AParameter.w=euclideanProjection(l2AParameter.w);for(var _i2=0;_i2<bitrateCount;++_i2){diff1[_i2]=l2AParameter.w[_i2]-l2AParameter.prev_w[_i2];l2AParameter.prev_w[_i2]=l2AParameter.w[_i2];}// Lagrangian multiplier Q calculation:
l2AParameter.Q=Math.max(0,l2AParameter.Q-V+V*currentPlaybackRate*((_dotmultiplication(bitrates,l2AParameter.prev_w)+_dotmultiplication(bitrates,diff1))/lastthroughput));// Quality is calculated as argmin of the absolute difference between available bitrates (bitrates[i]) and bitrate estimation (dotmultiplication(w,bitrates)).
var temp=[];for(var _i3=0;_i3<bitrateCount;++_i3){temp[_i3]=Math.abs(bitrates[_i3]-_dotmultiplication(l2AParameter.w,bitrates));}// Quality is calculated based on the probability distribution w (the output of L2A)
quality=temp.indexOf(Math.min.apply(Math,temp));// We employ a cautious -stepwise- ascent
if(quality>l2AState.lastQuality){if(bitrates[l2AState.lastQuality+1]<=lastthroughput){quality=l2AState.lastQuality+1;}}// Provision against bitrate over-estimation, by re-calibrating the Lagrangian multiplier Q, to be taken into account for the next chunk
if(bitrates[quality]>=lastthroughput){l2AParameter.Q=react*Math.max(vl,l2AParameter.Q);}switchRequest.quality=quality;switchRequest.reason.throughput=throughput;switchRequest.reason.latency=latency;switchRequest.reason.bufferLevel=bufferLevel;l2AState.lastQuality=switchRequest.quality;break;default:// should not arrive here, try to recover
logger.debug('L2A ABR rule invoked in bad state.');switchRequest.quality=abrController.getQualityForBitrate(mediaInfo,safeThroughput,latency);switchRequest.reason.state=l2AState.state;switchRequest.reason.throughput=safeThroughput;switchRequest.reason.latency=latency;l2AState.state=L2A_STATE_STARTUP;_clearL2AStateOnSeek(l2AState);}return switchRequest;}/**
     * Reset objects to their initial state
     * @private
     */function _resetInitialSettings(){l2AStateDict={};l2AParameterDict={};}/**
     * Reset the rule
     */function reset(){_resetInitialSettings();eventBus.off(_Events2.default.PLAYBACK_SEEKING,_onPlaybackSeeking,instance);eventBus.off(_Events2.default.MEDIA_FRAGMENT_LOADED,_onMediaFragmentLoaded,instance);eventBus.off(_Events2.default.METRIC_ADDED,_onMetricAdded,instance);eventBus.off(_Events2.default.QUALITY_CHANGE_REQUESTED,_onQualityChangeRequested,instance);}instance={getMaxIndex:getMaxIndex,reset:reset};setup();return instance;}L2ARule.__dashjs_factory_name='L2ARule';exports.default=_FactoryMaker2.default.getClassFactory(L2ARule);
//# sourceMappingURL=L2ARule.js.map