'use strict';Object.defineProperty(exports,"__esModule",{value:true});var _FactoryMaker=require('../../core/FactoryMaker');var _FactoryMaker2=_interopRequireDefault(_FactoryMaker);var _Debug=require('../../core/Debug');var _Debug2=_interopRequireDefault(_Debug);var _EventBus=require('../../core/EventBus');var _EventBus2=_interopRequireDefault(_EventBus);var _MediaPlayerEvents=require('../../streaming/MediaPlayerEvents');var _MediaPlayerEvents2=_interopRequireDefault(_MediaPlayerEvents);var _XHRLoader=require('../net/XHRLoader');var _XHRLoader2=_interopRequireDefault(_XHRLoader);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function EventController(){var MPD_RELOAD_SCHEME='urn:mpeg:dash:event:2012';var MPD_RELOAD_VALUE=1;var MPD_CALLBACK_SCHEME='urn:mpeg:dash:event:callback:2015';var MPD_CALLBACK_VALUE=1;var REFRESH_DELAY=100;var REMAINING_EVENTS_THRESHOLD=300;var EVENT_HANDLED_STATES={DISCARDED:'discarded',UPDATED:'updated',ADDED:'added'};var context=this.context;var eventBus=(0,_EventBus2.default)(context).getInstance();var instance=void 0,logger=void 0,inlineEvents=void 0,// Holds all Inline Events not triggered yet
inbandEvents=void 0,// Holds all Inband Events not triggered yet
eventInterval=void 0,// variable holding the setInterval
lastEventTimerCall=void 0,manifestUpdater=void 0,playbackController=void 0,eventHandlingInProgress=void 0,isStarted=void 0;/**
     * Internal setup when class is instanced
     */function _setup(){logger=(0,_Debug2.default)(context).getInstance().getLogger(instance);_resetInitialSettings();}/**
     * Checks if the provded configuration is valid
     */function checkConfig(){if(!manifestUpdater||!playbackController){throw new Error('setConfig function has to be called previously');}}/**
     * Reset to initial settings
     */function _resetInitialSettings(){isStarted=false;inlineEvents={};// Format inlineEvents[schemeIdUri]
inbandEvents={};// Format inlineEvents[schemeIdUri]
eventInterval=null;eventHandlingInProgress=false;lastEventTimerCall=Date.now()/1000;}/**
     * Stops the EventController by clearing the event interval
     */function _stop(){try{if(eventInterval!==null&&isStarted){clearInterval(eventInterval);eventInterval=null;isStarted=false;_onStopEventController();}}catch(e){throw e;}}/**
     * Starts the interval function of the EventController
     */function start(){try{checkConfig();logger.debug('Start Event Controller');if(!isStarted&&!isNaN(REFRESH_DELAY)){isStarted=true;eventInterval=setInterval(_onEventTimer,REFRESH_DELAY);}}catch(e){throw e;}}/**
     * Add MPD events to the list of events.
     * Events that are not in the MPD anymore but not triggered yet will still be deleted.
     * Existing events might get updated.
     * @param {Array.<Object>} values
     */function addInlineEvents(values){try{checkConfig();if(values){for(var i=0;i<values.length;i++){var event=values[i];var result=_addOrUpdateEvent(event,inlineEvents,true);if(result===EVENT_HANDLED_STATES.ADDED){logger.debug('Added inline event with id '+event.id);// If we see the event for the first time we trigger it in onReceive mode
_startEvent(event,values,_MediaPlayerEvents2.default.EVENT_MODE_ON_RECEIVE);}else if(result===EVENT_HANDLED_STATES.UPDATED){logger.debug('Updated inline event with id '+event.id);}}}logger.debug('Added '+values.length+' inline events');}catch(e){throw e;}}/**
     * Add EMSG events to the list of events
     * Messages with the same id within the scope of the same scheme_id_uri and value pair are equivalent , i.e. processing of any one event message box with the same id is sufficient.
     * @param {Array.<Object>} values
     */function addInbandEvents(values){try{checkConfig();for(var i=0;i<values.length;i++){var event=values[i];var result=_addOrUpdateEvent(event,inbandEvents,false);if(result===EVENT_HANDLED_STATES.ADDED){if(event.eventStream.schemeIdUri===MPD_RELOAD_SCHEME&&inbandEvents[event.id]===undefined){_handleManifestReloadEvent(event);}logger.debug('Added inband event with id '+event.id);_startEvent(event,values,_MediaPlayerEvents2.default.EVENT_MODE_ON_RECEIVE);}else{logger.debug('Inband event with scheme_id_uri '+event.eventStream.schemeIdUri+', value '+event.eventStream.value+' and id '+event.id+' was ignored because it has been added before.');}}_onEventTimer();}catch(e){throw e;}}/**
     * Adds or updates an event to/in the list of events
     * @param {object} event
     * @param {object} events
     * @param {boolean} shouldOverwriteExistingEvents
     * @return {string}
     * @private
     */function _addOrUpdateEvent(event,events){var shouldOverwriteExistingEvents=arguments.length>2&&arguments[2]!==undefined?arguments[2]:false;var schemeIdUri=event.eventStream.schemeIdUri;var value=event.eventStream.value;var id=event.id;var eventState=EVENT_HANDLED_STATES.DISCARDED;if(!events[schemeIdUri]){events[schemeIdUri]=[];}var indexOfExistingEvent=events[schemeIdUri].findIndex(function(e){return(!value||e.eventStream.value&&e.eventStream.value===value)&&e.id===id;});if(indexOfExistingEvent===-1){events[schemeIdUri].push(event);eventState=EVENT_HANDLED_STATES.ADDED;}else if(shouldOverwriteExistingEvents){events[schemeIdUri][indexOfExistingEvent]=event;eventState=EVENT_HANDLED_STATES.UPDATED;}return eventState;}/**
     * Triggers an MPD reload
     * @param {object} event
     * @private
     */function _handleManifestReloadEvent(event){try{if(event.eventStream.value==MPD_RELOAD_VALUE){var validUntil=event.calculatedPresentationTime;var newDuration=void 0;if(event.calculatedPresentationTime==0xFFFFFFFF){//0xFF... means remaining duration unknown
newDuration=NaN;}else{newDuration=event.calculatedPresentationTime+event.duration;}//logger.info('Manifest validity changed: Valid until: ' + validUntil + '; remaining duration: ' + newDuration);
eventBus.trigger(_MediaPlayerEvents2.default.MANIFEST_VALIDITY_CHANGED,{id:event.id,validUntil:validUntil,newDuration:newDuration,newManifestValidAfter:NaN//event.message_data - this is an arraybuffer with a timestring in it, but not used yet
},{mode:_MediaPlayerEvents2.default.EVENT_MODE_ON_START});}}catch(e){}}/**
     * Iterate through the eventList and trigger the events
     */function _onEventTimer(){try{if(!eventHandlingInProgress){eventHandlingInProgress=true;var currentVideoTime=playbackController.getTime();var presentationTimeThreshold=currentVideoTime-lastEventTimerCall;// For dynamic streams lastEventTimeCall will be large in the first iteration. Avoid firing all events at once.
presentationTimeThreshold=lastEventTimerCall>0?Math.max(0,presentationTimeThreshold):0;_triggerEvents(inbandEvents,presentationTimeThreshold,currentVideoTime);_triggerEvents(inlineEvents,presentationTimeThreshold,currentVideoTime);lastEventTimerCall=currentVideoTime;eventHandlingInProgress=false;}}catch(e){eventHandlingInProgress=false;}}/**
     * When the EventController is stopped this callback is triggered. Starts the remaining events.
     * @private
     */function _onStopEventController(){try{// EventController might be stopped before the period is over. Before we stop the event controller we check for events that needs to be triggered at the period boundary.
_triggerRemainingEvents(inbandEvents);_triggerRemainingEvents(inlineEvents);}catch(e){}}/**
     * Iterate over a list of events and trigger the ones for which the presentation time is within the current timing interval
     * @param {object} events
     * @param {number} presentationTimeThreshold
     * @param {number} currentVideoTime
     * @private
     */function _triggerEvents(events,presentationTimeThreshold,currentVideoTime){try{var callback=function callback(event){if(event!==undefined){var duration=!isNaN(event.duration)?event.duration:0;// The event is either about to start or has already been started and we are within its duration
if(event.calculatedPresentationTime<=currentVideoTime&&event.calculatedPresentationTime+presentationTimeThreshold+duration>=currentVideoTime){_startEvent(event,events,_MediaPlayerEvents2.default.EVENT_MODE_ON_START);}else if(_eventHasExpired(currentVideoTime,duration+presentationTimeThreshold,event.calculatedPresentationTime)||_eventIsInvalid(event)){logger.debug('Deleting event '+event.id+' as it is expired or invalid');_removeEvent(events,event);}}};_iterateAndTriggerCallback(events,callback);}catch(e){}}/**
     * Triggers the remaining events after the EventController has been stopped
     * @param {object} events
     * @private
     */function _triggerRemainingEvents(events){try{var currentTime=playbackController.getTime();var callback=function callback(event){var periodDuration=event.eventStream&&event.eventStream.period&&!isNaN(event.eventStream.period.duration)?event.eventStream.period.duration:NaN;var periodStart=event.eventStream&&event.eventStream.period&&!isNaN(event.eventStream.period.start)?event.eventStream.period.start:NaN;if(isNaN(periodDuration)||isNaN(periodStart)){return;}var calculatedPresentationTimeInSeconds=event.calculatedPresentationTime;if(Math.abs(calculatedPresentationTimeInSeconds-currentTime)<REMAINING_EVENTS_THRESHOLD){_startEvent(event,events,_MediaPlayerEvents2.default.EVENT_MODE_ON_START);}};_iterateAndTriggerCallback(events,callback());}catch(e){}}/**
     * Iterates over the inline/inband event object and triggers a callback for each event
     * @param {object} events
     * @param {function} callback
     * @private
     */function _iterateAndTriggerCallback(events,callback){try{if(events){var schemeIdUris=Object.keys(events);for(var i=0;i<schemeIdUris.length;i++){var schemeIdEvents=events[schemeIdUris[i]];schemeIdEvents.forEach(function(event){if(event!==undefined){callback(event);}});}}}catch(e){}}/**
     * Checks if an event is expired. For instance if the presentationTime + the duration of an event are smaller than the current video time.
     * @param {number} currentVideoTime
     * @param {number} threshold
     * @param {number} calculatedPresentationTimeInSeconds
     * @return {boolean}
     * @private
     */function _eventHasExpired(currentVideoTime,threshold,calculatedPresentationTimeInSeconds){try{return currentVideoTime-threshold>calculatedPresentationTimeInSeconds;}catch(e){return false;}}/**
     * Checks if an event is invalid. This is the case if the end time of the parent period is smaller than the presentation time of the event.
     * @param {object} event
     * @return {boolean}
     * @private
     */function _eventIsInvalid(event){try{var periodEndTime=event.eventStream.period.start+event.eventStream.period.duration;return event.calculatedPresentationTime>periodEndTime;}catch(e){return false;}}/**
     * Starts an event. Depending on the schemeIdUri we distinguis between
     * - MPD Reload events
     * - MPD Callback events
     * - Events to be dispatched to the application
     * Events should be removed from the list before beeing triggered. Otherwise the event handler might cause an error and the remove function will not be called.
     * @param {object} event
     * @param {object} events
     * @param {String} mode
     * @private
     */function _startEvent(event,events,mode){try{var currentVideoTime=playbackController.getTime();var eventId=event.id;if(mode===_MediaPlayerEvents2.default.EVENT_MODE_ON_RECEIVE){logger.debug('Received event '+eventId);eventBus.trigger(event.eventStream.schemeIdUri,{event:event},{mode:mode});return;}if(event.eventStream.schemeIdUri===MPD_RELOAD_SCHEME&&event.eventStream.value===MPD_RELOAD_VALUE){if(event.duration!==0||event.presentationTimeDelta!==0){//If both are set to zero, it indicates the media is over at this point. Don't reload the manifest.
logger.debug('Starting manifest refresh event '+eventId+' at '+currentVideoTime);_removeEvent(events,event);_refreshManifest();}}else if(event.eventStream.schemeIdUri===MPD_CALLBACK_SCHEME&&event.eventStream.value===MPD_CALLBACK_VALUE){logger.debug('Starting callback event '+eventId+' at '+currentVideoTime);_removeEvent(events,event);_sendCallbackRequest(event.messageData);}else{logger.debug('Starting event '+eventId+' at '+currentVideoTime);_removeEvent(events,event);eventBus.trigger(event.eventStream.schemeIdUri,{event:event},{mode:mode});}}catch(e){}}/**
     * Removes an event from the list. If this is the last event of type "schemeIdUri"  the corresponding schemeIdUri Object in the list of events is deleted.
     * @param {object} events
     * @param {object} event
     * @private
     */function _removeEvent(events,event){var schemeIdUri=event.eventStream.schemeIdUri;var value=event.eventStream.value;var id=event.id;events[schemeIdUri]=events[schemeIdUri].filter(function(e){return value&&e.eventStream.value&&e.eventStream.value!==value||e.id!==id;});if(events[schemeIdUri].length===0){delete events[schemeIdUri];}}/**
     * Refresh the manifest
     * @private
     */function _refreshManifest(){try{checkConfig();manifestUpdater.refreshManifest();}catch(e){}}/**
     * Send a callback request
     * @param {String} url
     * @private
     */function _sendCallbackRequest(url){try{var loader=(0,_XHRLoader2.default)(context).create({});loader.load({method:'get',url:url,request:{responseType:'arraybuffer'}});}catch(e){throw e;}}/**
     * Set the config of the EventController
     * @param {object} config
     */function setConfig(config){try{if(!config){return;}if(config.manifestUpdater){manifestUpdater=config.manifestUpdater;}if(config.playbackController){playbackController=config.playbackController;}}catch(e){throw e;}}/**
     * Returns all inline events that have not been triggered yet
     * @return {object}
     */function getInlineEvents(){return inlineEvents;}/**
     * Returns all inband events that have not been triggered yet
     * @return {object}
     */function getInbandEvents(){return inbandEvents;}/**
     * Stop the EventController and reset all initial settings
     */function reset(){_stop();_resetInitialSettings();}instance={addInlineEvents:addInlineEvents,addInbandEvents:addInbandEvents,getInbandEvents:getInbandEvents,getInlineEvents:getInlineEvents,start:start,setConfig:setConfig,reset:reset};_setup();return instance;}/**
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
 */EventController.__dashjs_factory_name='EventController';exports.default=_FactoryMaker2.default.getSingletonFactory(EventController);
//# sourceMappingURL=EventController.js.map