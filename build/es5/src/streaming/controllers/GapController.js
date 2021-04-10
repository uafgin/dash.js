'use strict';Object.defineProperty(exports,"__esModule",{value:true});var _FactoryMaker=require('../../core/FactoryMaker');var _FactoryMaker2=_interopRequireDefault(_FactoryMaker);var _Debug=require('../../core/Debug');var _Debug2=_interopRequireDefault(_Debug);var _Events=require('../../core/events/Events');var _Events2=_interopRequireDefault(_Events);var _EventBus=require('../../core/EventBus');var _EventBus2=_interopRequireDefault(_EventBus);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
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
 */var GAP_HANDLER_INTERVAL=100;var THRESHOLD_TO_STALLS=30;var GAP_THRESHOLD=0.1;function GapController(){var context=this.context;var eventBus=(0,_EventBus2.default)(context).getInstance();var instance=void 0,lastPlaybackTime=void 0,settings=void 0,wallclockTicked=void 0,gapHandlerInterval=void 0,lastGapJumpPosition=void 0,playbackController=void 0,streamController=void 0,videoModel=void 0,timelineConverter=void 0,adapter=void 0,jumpTimeoutHandler=void 0,logger=void 0;function initialize(){registerEvents();}function setup(){logger=(0,_Debug2.default)(context).getInstance().getLogger(instance);reset();}function reset(){stopGapHandler();unregisterEvents();resetInitialSettings();}function resetInitialSettings(){gapHandlerInterval=null;lastGapJumpPosition=NaN;wallclockTicked=0;jumpTimeoutHandler=null;}function setConfig(config){if(!config){return;}if(config.settings){settings=config.settings;}if(config.playbackController){playbackController=config.playbackController;}if(config.streamController){streamController=config.streamController;}if(config.videoModel){videoModel=config.videoModel;}if(config.timelineConverter){timelineConverter=config.timelineConverter;}if(config.adapter){adapter=config.adapter;}}function registerEvents(){eventBus.on(_Events2.default.WALLCLOCK_TIME_UPDATED,_onWallclockTimeUpdated,this);eventBus.on(_Events2.default.PLAYBACK_SEEKING,_onPlaybackSeeking,this);eventBus.on(_Events2.default.BYTES_APPENDED_END_FRAGMENT,onBytesAppended,instance);}function unregisterEvents(){eventBus.off(_Events2.default.WALLCLOCK_TIME_UPDATED,_onWallclockTimeUpdated,this);eventBus.off(_Events2.default.PLAYBACK_SEEKING,_onPlaybackSeeking,this);eventBus.off(_Events2.default.BYTES_APPENDED_END_FRAGMENT,onBytesAppended,instance);}function onBytesAppended(){if(!gapHandlerInterval){startGapHandler();}}function _onPlaybackSeeking(){if(jumpTimeoutHandler){clearTimeout(jumpTimeoutHandler);jumpTimeoutHandler=null;}}function _onWallclockTimeUpdated()/*e*/{if(!_shouldCheckForGaps()){return;}wallclockTicked++;if(wallclockTicked>=THRESHOLD_TO_STALLS){var currentTime=playbackController.getTime();if(lastPlaybackTime===currentTime){jumpGap(currentTime,true);}else{lastPlaybackTime=currentTime;lastGapJumpPosition=NaN;}wallclockTicked=0;}}function _shouldCheckForGaps(){return settings.get().streaming.jumpGaps&&streamController.getActiveStreamProcessors().length>0&&(!playbackController.isSeeking()||streamController.hasStreamFinishedBuffering(streamController.getActiveStream()))&&!playbackController.isPaused()&&!streamController.getIsStreamSwitchInProgress()&&!streamController.getHasMediaOrIntialisationError();}function getNextRangeIndex(ranges,currentTime){try{if(!ranges||ranges.length<=1&&currentTime>0){return NaN;}var nextRangeIndex=NaN;var j=0;while(isNaN(nextRangeIndex)&&j<ranges.length){var rangeEnd=j>0?ranges.end(j-1):0;if(currentTime<ranges.start(j)&&rangeEnd-currentTime<GAP_THRESHOLD){nextRangeIndex=j;}j+=1;}return nextRangeIndex;}catch(e){return null;}}function startGapHandler(){try{if(!gapHandlerInterval){logger.debug('Starting the gap controller');gapHandlerInterval=setInterval(function(){if(!_shouldCheckForGaps()){return;}var currentTime=playbackController.getTime();jumpGap(currentTime);},GAP_HANDLER_INTERVAL);}}catch(e){}}function stopGapHandler(){logger.debug('Stopping the gap controller');if(gapHandlerInterval){clearInterval(gapHandlerInterval);gapHandlerInterval=null;}}function jumpGap(currentTime){var playbackStalled=arguments.length>1&&arguments[1]!==undefined?arguments[1]:false;var smallGapLimit=settings.get().streaming.smallGapLimit;var jumpLargeGaps=settings.get().streaming.jumpLargeGaps;var ranges=videoModel.getBufferRange();var nextRangeIndex=void 0;var seekToPosition=NaN;var jumpToStreamEnd=false;// Get the range just after current time position
nextRangeIndex=getNextRangeIndex(ranges,currentTime);if(!isNaN(nextRangeIndex)){var start=ranges.start(nextRangeIndex);var gap=start-currentTime;if(gap>0&&(gap<=smallGapLimit||jumpLargeGaps)){seekToPosition=start;}}// Playback has stalled before period end. We seek to the end of the period
var timeToStreamEnd=playbackController.getTimeToStreamEnd();if(isNaN(seekToPosition)&&playbackStalled&&isFinite(timeToStreamEnd)&&!isNaN(timeToStreamEnd)&&timeToStreamEnd<smallGapLimit){seekToPosition=parseFloat(playbackController.getStreamEndTime().toFixed(5));jumpToStreamEnd=true;}if(seekToPosition>0&&lastGapJumpPosition!==seekToPosition&&seekToPosition>currentTime&&!jumpTimeoutHandler){var timeUntilGapEnd=seekToPosition-currentTime;if(jumpToStreamEnd){logger.warn('Jumping to end of stream because of gap from '+currentTime+' to '+seekToPosition+'. Gap duration: '+timeUntilGapEnd);eventBus.trigger(_Events2.default.GAP_CAUSED_SEEK_TO_PERIOD_END,{seekTime:seekToPosition,duration:timeUntilGapEnd});}else{var isDynamic=playbackController.getIsDynamic();var _start=nextRangeIndex>0?ranges.end(nextRangeIndex-1):currentTime;var timeToWait=!isDynamic?0:timeUntilGapEnd*1000;jumpTimeoutHandler=window.setTimeout(function(){playbackController.seek(seekToPosition,true,true);logger.warn('Jumping gap starting at '+_start+' and ending at '+seekToPosition+'. Jumping by: '+timeUntilGapEnd);eventBus.trigger(_Events2.default.GAP_CAUSED_INTERNAL_SEEK,{seekTime:seekToPosition,duration:timeUntilGapEnd});jumpTimeoutHandler=null;},timeToWait);}lastGapJumpPosition=seekToPosition;}}instance={reset:reset,setConfig:setConfig,initialize:initialize};setup();return instance;}GapController.__dashjs_factory_name='GapController';exports.default=_FactoryMaker2.default.getSingletonFactory(GapController);
//# sourceMappingURL=GapController.js.map