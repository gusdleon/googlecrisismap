// Copyright 2013 Google Inc.  All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at: http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distrib-
// uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
// OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
// specific language governing permissions and limitations under the License.

goog.require('cm.LayersTabItem');
goog.require('cm.TestBase');
goog.require('cm.ToolbarView');
goog.require('cm.css');

goog.require('goog.module.Loader');

function LayersTabItemTest() {
  cm.TestBase.call(this);
  this.mapModel_ = cm.MapModel.newFromMapRoot({});
  this.appState_ = new cm.AppState();
  this.metadataModel_ = new cm.MetadataModel(this.mapModel_);
  this.config_ = {
    'enable_editing': false,
    'enable_layer_filter': true
  };
}
LayersTabItemTest.prototype = new cm.TestBase();
registerTestSuite(LayersTabItemTest);

LayersTabItemTest.prototype.addLayer_ = function(layerId, layerTitle) {
  var newLayer = cm.LayerModel.newFromMapRoot({
    id: layerId,
    title: layerTitle,
    type: 'KML'
  });
  this.mapModel_.get('layers').push(newLayer);
  return newLayer;
};

LayersTabItemTest.prototype.createLayersTabItem_ = function(opt_config) {
  return new cm.LayersTabItem(
      this.mapModel_, this.appState_, opt_config || this.config_,
      this.metadataModel_);
};

LayersTabItemTest.prototype.testCreation_noLayers = function() {
  var layersTab = this.createLayersTabItem_();
  expectTrue(layersTab.getContent());
};

LayersTabItemTest.prototype.testCreation_startingLayers = function() {
  this.addLayer_('layer1', 'title 1');
  this.addLayer_('layer2', 'title 2');
  var layersTab = this.createLayersTabItem_();
  expectDescendantOf(layersTab.getContent(), withText(hasSubstr('title 1')));
  expectDescendantOf(layersTab.getContent(), withText(hasSubstr('title 2')));
};

/** Tests the TOGGLE_LAYER event is forwarded properly. */
LayersTabItemTest.prototype.testToggleLayerEventForwarded = function() {
  var layer = this.addLayer_('layer1', 'testToggleLayerEventForwarded');
  var layersTab = this.createLayersTabItem_();
  this.expectEvent(layersTab, cm.events.TOGGLE_LAYER, 1, function(props) {
    return (props.id === 'layer1');
  });
  var checkbox = expectDescendantOf(
      layersTab.getContent(), withAttr('type', 'checkbox'));
  cm.events.emit(checkbox, 'click');
};

/** Tests the ZOOM_TO_LAYER event is forwarded properly. */
LayersTabItemTest.prototype.testZoomToLayerEventForwarded = function() {
  var layer = this.addLayer_('my_layer', 'testZoomToLayerEventForwarded');
  var layersTab = this.createLayersTabItem_();
  this.expectEvent(layersTab, cm.events.ZOOM_TO_LAYER, 1, function(props) {
    return (props.id === 'my_layer');
  });
  var zoomLink = expectDescendantOf(
      layersTab.getContent(), withText(cm.MSG_ZOOM_TO_AREA_LINK));
  cm.events.emit(zoomLink, 'click');
};

/** Tests the DELETE_LAYER event is forwarded properly. */
LayersTabItemTest.prototype.testDeleteLayerEventForwarded = function() {
  goog.module.Loader.provide('edit', 'cm.ToolbarView', cm.ToolbarView);
  var layer = this.addLayer_('my_layer', 'testDeleteLayerEventForwarded');
  var layersTab = this.createLayersTabItem_({'enable_editing': true});
  this.expectEvent(cm.app, cm.events.DELETE_LAYER, 1, function(props) {
    return (props.id === 'my_layer');
  });
  var zoomLink = expectDescendantOf(
      layersTab.getContent(), withText(cm.MSG_DELETE));
  cm.events.emit(zoomLink, 'click');
};

/**
 * Tests that a LayerEntryView is created when a layer is added to the MapModel.
 */
LayersTabItemTest.prototype.testInsertLayer = function() {
  // Start with an empty layer array.
  var layersTab = this.createLayersTabItem_();

  // Append two layers to the end of the layer array, then insert one in front
  // of the other two
  this.addLayer_('layer1', 'Layer One');
  this.addLayer_('layer2', 'Layer Two');
  var layerModel = cm.LayerModel.newFromMapRoot({
    id: 'layer3',
    title: 'Layer Three',
    type: 'KML'
  });
  this.mapModel_.get('layers').insertAt(0, layerModel);

  var layerElems = allDescendantsOf(
      layersTab.getContent(), withClass(cm.css.LAYER_ENTRY));
  var layerTitles = [];
  layerElems.forEach(function(elem) {
    layerTitles.push(cm.ui.getText(expectDescendantOf(
        elem, withClass(cm.css.LAYER_TITLE))));
  }, this);

  expectEq(['Layer Three', 'Layer One', 'Layer Two'], layerTitles);
};


LayersTabItemTest.createLayerModel_ = function(id) {
  var layerModel = new google.maps.MVCObject();
  layerModel.set('id', id);
  layerModel.isSingleSelect = function() { return false; };
  return layerModel;
};

/**
 * Tests that when a layer is removed from the MapModel, its
 * LayerEntryView is destroyed.
 */
LayersTabItemTest.prototype.testRemoveLayer = function() {
  // Start with two layers.
  var layerModel1 = this.addLayer_('layer1', 'Layer One');
  var layerModel2 = this.addLayer_('layer2', 'Layer Two');

  var layerEntry1 = this.expectNew_(
      'cm.LayerEntryView', _, layerModel1, _, _, this.config_, _, false);
  var layerEntry2 = this.expectNew_(
      'cm.LayerEntryView', _, layerModel2, _, _, this.config_, _, false);
  var layersTab = this.createLayersTabItem_();

  // Remove both layers.
  expectCall(layerEntry2.dispose)();
  this.mapModel_.get('layers').removeAt(1);

  expectCall(layerEntry1.dispose)();
  this.mapModel_.get('layers').pop();

  expectNoDescendantOf(layersTab.getContent(), withClass(cm.css.LAYER_ENTRY));
};

/**
 * Tests the binding between the AppState's query and the layer filter's
 * input value.
 */
LayersTabItemTest.prototype.testFilterLayers = function() {
  var layersTab = this.createLayersTabItem_();
  var query = 'some query';
  var newQuery = 'something else';
  var layerFilterDiv = findDescendantOf(
      layersTab.getContent(), withClass(cm.css.LAYER_FILTER));
  var layerFilterInput = findDescendantOf(layerFilterDiv, isElement('input'));

  // The first time the AppState query value changes, the text input value
  // should change (so that on page load the query URL parameter is recognized).
  expectEq('', layerFilterInput.value);
  this.appState_.setFilterQuery(query);
  expectEq(query, layerFilterInput.value);

  // Subsequent AppState query changes should not affect the text input value.
  this.appState_.setFilterQuery(newQuery);
  expectEq(query, layerFilterInput.value);

  // An event should fire when the text input value changes.
  layerFilterInput.value = query;
  this.expectEvent(layersTab, cm.events.FILTER_QUERY_CHANGED, 1,
                   function(props) { return (query === props.query); });
  cm.events.emit(layerFilterInput, 'input');
};

/** Tests that the layer filter's presence matches its config setting. */
LayersTabItemTest.prototype.testFilterLayersNotConfigured = function() {
  this.config_ = {'enable_layer_filter': false};
  var layersTab = this.createLayersTabItem_();
  expectNoDescendantOf(layersTab.getContent(), withClass(cm.css.LAYER_FILTER));
};

/** Tests that the legend has been omitted from the layers tab. */
LayersTabItemTest.prototype.testNoLegends = function() {
  var legendLayer = this.addLayer_(
      'testNoLegends', 'Layer with a legend');
  legendLayer.set(
      'legend', cm.Html.fromSanitizedHtml('<b>Look!</b><br/>A legend!<br/>'));
  var layersTab = this.createLayersTabItem_();
  expectNoDescendantOf(layersTab.getContent(), withClass(cm.css.LAYER_LEGEND));
};

/**
 * Tests that LayerEntryViews receive wasRevealed() after they have been
 * placed in the DOM on tab selection.  See the comment for
 * cm.LayersTabItem.handleTabSelectionChanged_() for the full details, but
 * it works around a bug in goog.ui.Slider not being updated properly while
 * not in the DOM.
 */
LayersTabItemTest.prototype.testWasRevealedSent = function() {
  var revealedIds = {};
  var mockWasRevealed = function() {
    revealedIds[this.model_.get('id')] = true;
  };
  this.setForTest_('cm.LayerEntryView.prototype.wasRevealed', mockWasRevealed);
  var revealedLayer = this.addLayer_(
      'testWasRevealedSent_reveal', 'Should Reveal');
  this.appState_.setLayerEnabled(revealedLayer.get('id'), true);
  var unrevealedLayer = this.addLayer_(
      'testWasRevealedSent_noReveal', 'No Reveal');
  this.appState_.setLayerEnabled(unrevealedLayer.get('id'), false);

  var layersTab = this.createLayersTabItem_();
  // Need another tab to be selected, so we create the about tab too.
  var aboutTab = new cm.AboutTabItem(
      this.mapModel_, this.appState_, this.config_);
  var tabView = new cm.TabView();
  tabView.appendTabItem(aboutTab);
  tabView.selectTabItem(aboutTab);
  tabView.appendTabItem(layersTab);

  for (key in revealedIds) {
    revealedIds[key] = false;
  }
  tabView.selectTabItem(layersTab);
  expectTrue(revealedIds[revealedLayer.get('id')]);
  expectFalse(revealedIds[unrevealedLayer.get('id')]);
};

LayersTabItemTest.prototype.testAnalyticsSelectionEvent = function() {
  var tabView = new cm.TabView();
  var layersTab = this.createLayersTabItem_();
  var aboutTab = new cm.AboutTabItem(
      this.mapModel_, this.appState_, this.config_);
  tabView.appendTabItem(aboutTab);
  tabView.appendTabItem(layersTab);
  tabView.render(cm.ui.create('div'));
  tabView.tabBar_.selectTab(1);
  this.expectLogAction(cm.Analytics.TabPanelAction.LAYERS_TAB_SELECTED, null);

  cm.events.emit(tabView.tabBar_, cm.TabBar.TAB_SELECTED);
};
