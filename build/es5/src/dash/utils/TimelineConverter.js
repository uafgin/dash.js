'use strict';Object.defineProperty(exports,"__esModule",{value:true});var _EventBus=require('../../core/EventBus');var _EventBus2=_interopRequireDefault(_EventBus);var _Events=require('../../core/events/Events');var _Events2=_interopRequireDefault(_Events);var _FactoryMaker=require('../../core/FactoryMaker');var _FactoryMaker2=_interopRequireDefault(_FactoryMaker);var _DashConstants=require('../constants/DashConstants');var _DashConstants2=_interopRequireDefault(_DashConstants);var _DashManifestModel=require('../models/DashManifestModel');var _DashManifestModel2=_interopRequireDefault(_DashManifestModel);var _Settings=require('../../core/Settings');var _Settings2=_interopRequireDefault(_Settings);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}/**
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
 */function TimelineConverter(){var context=this.context;var eventBus=(0,_EventBus2.default)(context).getInstance();var settings=(0,_Settings2.default)(context).getInstance();var instance=void 0,dashManifestModel=void 0,clientServerTimeShift=void 0,isClientServerTimeSyncCompleted=void 0,expectedLiveEdge=void 0;function setup(){dashManifestModel=(0,_DashManifestModel2.default)(context).getInstance();reset();}function initialize(){resetInitialSettings();eventBus.on(_Events2.default.UPDATE_TIME_SYNC_OFFSET,_onUpdateTimeSyncOffset,this);}function getClientTimeOffset(){return clientServerTimeShift;}function setClientTimeOffset(value){clientServerTimeShift=value;}function getExpectedLiveEdge(){return expectedLiveEdge;}function setExpectedLiveEdge(value){expectedLiveEdge=value;}function calcAvailabilityTimeFromPresentationTime(presentationTime,mpd,isDynamic,calculateEnd){var availabilityTime=NaN;if(calculateEnd){//@timeShiftBufferDepth specifies the duration of the time shifting buffer that is guaranteed
// to be available for a Media Presentation with type 'dynamic'.
// When not present, the value is infinite.
if(isDynamic&&mpd.timeShiftBufferDepth!=Number.POSITIVE_INFINITY){availabilityTime=new Date(mpd.availabilityStartTime.getTime()+(presentationTime+mpd.timeShiftBufferDepth)*1000);}else{availabilityTime=mpd.availabilityEndTime;}}else{if(isDynamic){availabilityTime=new Date(mpd.availabilityStartTime.getTime()+(presentationTime-clientServerTimeShift)*1000);}else{// in static mpd, all segments are available at the same time
availabilityTime=mpd.availabilityStartTime;}}return availabilityTime;}function calcAvailabilityStartTimeFromPresentationTime(presentationTime,mpd,isDynamic){return calcAvailabilityTimeFromPresentationTime.call(this,presentationTime,mpd,isDynamic);}function calcAvailabilityEndTimeFromPresentationTime(presentationTime,mpd,isDynamic){return calcAvailabilityTimeFromPresentationTime.call(this,presentationTime,mpd,isDynamic,true);}function calcPresentationTimeFromWallTime(wallTime,period){return(wallTime.getTime()-period.mpd.availabilityStartTime.getTime()+clientServerTimeShift*1000)/1000;}function calcPresentationTimeFromMediaTime(mediaTime,representation){var periodStart=representation.adaptation.period.start;var presentationOffset=representation.presentationTimeOffset;return mediaTime+(periodStart-presentationOffset);}function calcMediaTimeFromPresentationTime(presentationTime,representation){var periodStart=representation.adaptation.period.start;var presentationOffset=representation.presentationTimeOffset;return presentationTime-periodStart+presentationOffset;}function calcWallTimeForSegment(segment,isDynamic){var suggestedPresentationDelay=void 0,displayStartTime=void 0,wallTime=void 0;if(isDynamic){suggestedPresentationDelay=segment.representation.adaptation.period.mpd.suggestedPresentationDelay;displayStartTime=segment.presentationStartTime+suggestedPresentationDelay;wallTime=new Date(segment.availabilityStartTime.getTime()+displayStartTime*1000);}return wallTime;}function calcSegmentAvailabilityRange(voRepresentation,isDynamic){// Static Range Finder
var voPeriod=voRepresentation.adaptation.period;var range={start:voPeriod.start,end:voPeriod.start+voPeriod.duration};if(!isDynamic)return range;if(!isClientServerTimeSyncCompleted&&voRepresentation.segmentAvailabilityRange){return voRepresentation.segmentAvailabilityRange;}// Dynamic Range Finder
var d=voRepresentation.segmentDuration||(voRepresentation.segments&&voRepresentation.segments.length?voRepresentation.segments[voRepresentation.segments.length-1].duration:0);// Specific use case of SegmentTimeline without timeShiftBufferDepth
if(voRepresentation.segmentInfoType===_DashConstants2.default.SEGMENT_TIMELINE&&settings.get().streaming.calcSegmentAvailabilityRangeFromTimeline){return calcSegmentAvailabilityRangeFromTimeline(voRepresentation);}var now=calcPresentationTimeFromWallTime(new Date(),voPeriod);var periodEnd=voPeriod.start+voPeriod.duration;range.start=Math.max(now-voPeriod.mpd.timeShiftBufferDepth,voPeriod.start);var endOffset=voRepresentation.availabilityTimeOffset!==undefined&&voRepresentation.availabilityTimeOffset<d?d-voRepresentation.availabilityTimeOffset:d;range.end=now>=periodEnd&&now-endOffset<periodEnd?periodEnd:now-endOffset;return range;}function calcSegmentAvailabilityRangeFromTimeline(voRepresentation){var adaptation=voRepresentation.adaptation.period.mpd.manifest.Period_asArray[voRepresentation.adaptation.period.index].AdaptationSet_asArray[voRepresentation.adaptation.index];var representation=dashManifestModel.getRepresentationFor(voRepresentation.index,adaptation);var timeline=representation.SegmentTemplate.SegmentTimeline;var timescale=representation.SegmentTemplate.timescale;var segments=timeline.S_asArray;var range={start:0,end:0};var d=0;var segment=void 0,repeat=void 0,i=void 0,len=void 0;range.start=calcPresentationTimeFromMediaTime(segments[0].t/timescale,voRepresentation);for(i=0,len=segments.length;i<len;i++){segment=segments[i];repeat=0;if(segment.hasOwnProperty('r')){repeat=segment.r;}d+=segment.d/timescale*(1+repeat);}range.end=range.start+d;return range;}function getPeriodEnd(voRepresentation,isDynamic){// Static Range Finder
var voPeriod=voRepresentation.adaptation.period;if(!isDynamic){return voPeriod.start+voPeriod.duration;}if(!isClientServerTimeSyncCompleted&&voRepresentation.segmentAvailabilityRange){return voRepresentation.segmentAvailabilityRange;}// Dynamic Range Finder
var d=voRepresentation.segmentDuration||(voRepresentation.segments&&voRepresentation.segments.length?voRepresentation.segments[voRepresentation.segments.length-1].duration:0);var now=calcPresentationTimeFromWallTime(new Date(),voPeriod);var periodEnd=voPeriod.start+voPeriod.duration;var endOffset=voRepresentation.availabilityTimeOffset!==undefined&&voRepresentation.availabilityTimeOffset<d?d-voRepresentation.availabilityTimeOffset:d;return Math.min(now-endOffset,periodEnd);}function calcPeriodRelativeTimeFromMpdRelativeTime(representation,mpdRelativeTime){var periodStartTime=representation.adaptation.period.start;return mpdRelativeTime-periodStartTime;}/*
    * We need to figure out if we want to timesync for segmentTimeine where useCalculatedLiveEdge = true
    * seems we figure out client offset based on logic in liveEdgeFinder getLiveEdge timelineConverter.setClientTimeOffset(liveEdge - representationInfo.DVRWindow.end);
    * FYI StreamController's onManifestUpdated entry point to timeSync
    * */function _onUpdateTimeSyncOffset(e){if(e.offset!==undefined){setClientTimeOffset(e.offset/1000);isClientServerTimeSyncCompleted=true;}}function resetInitialSettings(){clientServerTimeShift=0;isClientServerTimeSyncCompleted=false;expectedLiveEdge=NaN;}function reset(){eventBus.off(_Events2.default.UPDATE_TIME_SYNC_OFFSET,_onUpdateTimeSyncOffset,this);resetInitialSettings();}instance={initialize:initialize,getClientTimeOffset:getClientTimeOffset,setClientTimeOffset:setClientTimeOffset,getExpectedLiveEdge:getExpectedLiveEdge,setExpectedLiveEdge:setExpectedLiveEdge,calcAvailabilityStartTimeFromPresentationTime:calcAvailabilityStartTimeFromPresentationTime,calcAvailabilityEndTimeFromPresentationTime:calcAvailabilityEndTimeFromPresentationTime,calcPresentationTimeFromWallTime:calcPresentationTimeFromWallTime,calcPresentationTimeFromMediaTime:calcPresentationTimeFromMediaTime,calcPeriodRelativeTimeFromMpdRelativeTime:calcPeriodRelativeTimeFromMpdRelativeTime,calcMediaTimeFromPresentationTime:calcMediaTimeFromPresentationTime,calcSegmentAvailabilityRange:calcSegmentAvailabilityRange,getPeriodEnd:getPeriodEnd,calcWallTimeForSegment:calcWallTimeForSegment,reset:reset};setup();return instance;}TimelineConverter.__dashjs_factory_name='TimelineConverter';exports.default=_FactoryMaker2.default.getSingletonFactory(TimelineConverter);
//# sourceMappingURL=TimelineConverter.js.map
