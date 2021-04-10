'use strict';Object.defineProperty(exports,"__esModule",{value:true});var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value"in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}/**
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
 *//**
 * @class
 * @ignore
 */var SimpleXPath=function(){function SimpleXPath(selector){var _this=this;_classCallCheck(this,SimpleXPath);// establish validation of the path, to catch unsupported cases
this.valid=selector[0]=='/';// first check, we only support absolute addressing
// establish parsed path, example:
// /MPD/Period[@id="foobar"]/AdaptationSet[@id="2"]/SegmentTemplate/SegmentTimeline
this.path=selector.split('/').filter(function(component){return component.length!==0;})// remove excess empty components
.map(function(component){var parsed={name:component};var qualifierPoint=component.indexOf('[');if(qualifierPoint!=-1){parsed.name=component.substring(0,qualifierPoint);var qualifier=component.substring(qualifierPoint+1,component.length-1);// quick sanity check are there additional qualifiers making this invalid
_this.valid=_this.valid&&qualifier.indexOf('[')==-1;var equalityPoint=qualifier.indexOf('=');if(equalityPoint!=-1){parsed.attribute={name:qualifier.substring(1,equalityPoint),// skip the @
value:qualifier.substring(equalityPoint+1)};// check for single and double quoted attribute values
if(['\'','"'].indexOf(parsed.attribute.value[0])!=-1){parsed.attribute.value=parsed.attribute.value.substring(1,parsed.attribute.value.length-1);}}else{// positional access in xpath is 1-based index
// internal processes will assume 0-based so we normalize that here
parsed.position=parseInt(qualifier,10)-1;}}return parsed;});}_createClass(SimpleXPath,[{key:'isValid',value:function isValid(){return this.valid;}},{key:'findsElement',value:function findsElement(){return!this.findsAttribute();}},{key:'findsAttribute',value:function findsAttribute(){return this.path[this.path.length-1].name.startsWith('@');}},{key:'getMpdTarget',value:function getMpdTarget(root,isSiblingOperation){var parent=null;var leaf=root;// assume root is MPD and we start at next level match
var level=1;var name='MPD';while(level<this.path.length&&leaf!==null){// set parent to current
parent=leaf;// select next leaf based on component
var component=this.path[level];name=component.name;// stop one early if this is the last element and an attribute
if(level!==this.path.length-1||!name.startsWith('@')){var children=parent[name+'_asArray']||[];if(children.length===0&&parent[name]){children.push(parent[name]);}if(component.position){leaf=children[component.position]||null;}else if(component.attribute){(function(){var attr=component.attribute;leaf=children.filter(function(elm){return elm[attr.name]==attr.value;})[0]||null;})();}else{// default case, select first
leaf=children[0]||null;}}level++;}if(leaf===null){// given path not found in root
return null;}// attributes the target is the leaf node, the name is the attribute
if(name.startsWith('@')){return{name:name.substring(1),leaf:leaf,target:leaf};}// otherwise we target the parent for sibling operations and leaf for child operations
return{name:name,leaf:leaf,target:isSiblingOperation?parent:leaf};}}]);return SimpleXPath;}();exports.default=SimpleXPath;
//# sourceMappingURL=SimpleXPath.js.map
