// ==UserScript==
// @name           Tab Mods — tabbrowser-tab class definition mods
// @version        1.4.3
// @author         aminomancer
// @homepageURL    https://github.com/aminomancer/uc.css.js
// @description    Restore the tab sound button and other aspects of the tab that (imo) were better before Proton.
// by adding a line to chrome.manifest this can be used to completely override the tab element template, markup and class methods:
// override chrome://browser/content/tabbrowser/tab.js ../resources/script-override/tabMods.uc.js
// @license        This Source Code Form is subject to the terms of the Creative Commons Attribution-NonCommercial-ShareAlike International License, v. 4.0. If a copy of the CC BY-NC-SA 4.0 was not distributed with this file, You can obtain one at http://creativecommons.org/licenses/by-nc-sa/4.0/ or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
// ==/UserScript==

"use strict";

// This is loaded into chrome windows with the subscript loader. Wrap in
// a block to prevent accidentally leaking globals onto `window`.
{
  class MozTabbrowserTab extends MozElements.MozTab {
    static markup = `
      <stack class="tab-stack" flex="1">
        <vbox class="tab-background">
          <hbox class="tab-context-line"/>
          <hbox class="tab-loading-burst" flex="1"/>
          <hbox class="tab-group-line"/>
        </vbox>
        <hbox class="tab-content" align="center">
          <stack class="tab-icon-stack">
            <image class="tab-close-button close-icon" role="button" keyNav="false"/>
            <hbox class="tab-throbber"/>
            <hbox class="tab-icon-pending"/>
            <html:img class="tab-icon-image" role="presentation" decoding="sync" />
            <image class="tab-sharing-icon-overlay" role="presentation"/>
            <image class="tab-icon-overlay" role="presentation"/>
          </stack>
          <vbox class="tab-label-container"
                onoverflow="this.setAttribute('textoverflow', 'true');"
                onunderflow="this.removeAttribute('textoverflow');"
                align="start"
                pack="center"
                flex="1">
            <label class="tab-text tab-label" role="presentation"/>
            <hbox class="tab-secondary-label">
              <label class="tab-icon-sound-label tab-icon-sound-playing-label" data-l10n-id="browser-tab-audio-playing2" role="presentation"/>
              <label class="tab-icon-sound-label tab-icon-sound-muted-label" data-l10n-id="browser-tab-audio-muted2" role="presentation"/>
              <label class="tab-icon-sound-label tab-icon-sound-blocked-label" data-l10n-id="browser-tab-audio-blocked" role="presentation"/>
              <label class="tab-icon-sound-label tab-icon-sound-pip-label" data-l10n-id="browser-tab-audio-pip" role="presentation"/>
              <label class="tab-icon-sound-label tab-icon-sound-tooltip-label" role="presentation"/>
            </hbox>
          </vbox>
          <image class="tab-icon-sound" role="button" keyNav="false"/>
        </hbox>
      </stack>
      `;

    constructor() {
      super();

      this.addEventListener("mouseover", this);
      this.addEventListener("mouseout", this);
      this.addEventListener("dragstart", this, true);
      this.addEventListener("dragstart", this);
      this.addEventListener("mousedown", this);
      this.addEventListener("mouseup", this);
      this.addEventListener("click", this);
      this.addEventListener("dblclick", this, true);
      this.addEventListener("animationend", this);
      this.addEventListener("focus", this);
      this.addEventListener("AriaFocus", this);

      this._hover = false;
      this._selectedOnFirstMouseDown = false;

      /**
       * Describes how the tab ended up in this mute state. May be any of:
       *
       * - undefined: The tabs mute state has never changed.
       * - null: The mute state was last changed through the UI.
       * - Any string: The ID was changed through an extension API. The string
       * must be the ID of the extension which changed it.
       */
      this.muteReason = undefined;

      this.mOverCloseButton = false;

      this.mCorrespondingMenuitem = null;

      this.closing = false;
    }

    static get inheritedAttributes() {
      return {
        ".tab-background":
          "selected=visuallyselected,fadein,multiselected,dragover-createGroup",
        ".tab-group-line": "selected=visuallyselected,multiselected",
        ".tab-loading-burst": "pinned,bursting,notselectedsinceload",
        ".tab-content":
          "pinned,selected=visuallyselected,multiselected,titlechanged,attention",
        ".tab-icon-stack":
          "sharing,pictureinpicture,crashed,busy,soundplaying,soundplaying-scheduledremoval,pinned,muted,blocked,selected=visuallyselected,activemedia-blocked,indicator-replaces-favicon",
        ".tab-throbber":
          "fadein,pinned,busy,progress,selected=visuallyselected",
        ".tab-icon-pending":
          "fadein,pinned,busy,progress,selected=visuallyselected,pendingicon",
        ".tab-icon-image":
          "src=image,triggeringprincipal=iconloadingprincipal,requestcontextid,fadein,pinned,selected=visuallyselected,busy,crashed,sharing,pictureinpicture",
        ".tab-sharing-icon-overlay": "sharing,selected=visuallyselected,pinned",
        ".tab-icon-overlay":
          "sharing,pictureinpicture,crashed,busy,soundplaying,soundplaying-scheduledremoval,pinned,muted,blocked,selected=visuallyselected,activemedia-blocked,indicator-replaces-favicon",
        ".tab-label-container":
          "pinned,selected=visuallyselected,labeldirection",
        ".tab-label":
          "text=label,accesskey,fadein,pinned,selected=visuallyselected,attention",
        ".tab-icon-sound":
          "soundplaying,soundplaying-scheduledremoval,pinned,muted,blocked,selected=visuallyselected,activemedia-blocked,pictureinpicture",
        ".tab-label-container .tab-secondary-label":
          "soundplaying,soundplaying-scheduledremoval,pinned,muted,blocked,selected=visuallyselected,activemedia-blocked,pictureinpicture",
        ".tab-close-button": "fadein,pinned,selected=visuallyselected",
      };
    }

    connectedCallback() {
      this.initialize();
    }

    initialize() {
      if (this._initialized) {
        return;
      }

      this.textContent = "";
      this.appendChild(this.constructor.fragment);
      this.initializeAttributeInheritance();
      this.setAttribute("context", "tabContextMenu");
      this._initialized = true;

      if (!("_lastAccessed" in this)) {
        this.updateLastAccessed();
      }

      let cardPreviewInit = () => {
        if (this.container._showCardPreviews) {
          if (!this.container._previewPanel) {
            // load the tab preview component
            const TabHoverPreviewPanel = ChromeUtils.importESModule(
              "chrome://browser/content/tabbrowser/tab-hover-preview.mjs"
            ).default;
            this.container._previewPanel = new TabHoverPreviewPanel(
              document.getElementById("tab-preview-panel")
            );
          }

          const { previewPanel } = this.container;

          if (!previewPanel) {
            return;
          }

          if (previewPanel._updatePreview.name === "_updatePreview") {
            // eslint-disable-next-line no-eval
            eval(
              `previewPanel._updatePreview = function uc_updatePreview ${previewPanel._updatePreview
                .toSource()
                .replace(/^\(/, "")
                .replace(/\)$/, "")
                .replace(/^_updatePreview/, "")
                .replace(
                  /[^\S\r\n]*this\._panel\.querySelector\("\.tab-preview-title"\)\.textContent =\s*this\._displayTitle;\s*this\._panel\.querySelector\("\.tab-preview-uri"\)\.textContent =\s*this\._displayURI;/m,
                  `this._tab._updatePreviewPanelText(true);`
                )}`
            );
          }

          if (previewPanel.getPrettyURI.name === "getPrettyURI") {
            // eslint-disable-next-line no-eval
            eval(
              `previewPanel.getPrettyURI = function uc_getPrettyURI ${previewPanel.getPrettyURI
                .toSource()
                .replace(/^\(/, "")
                .replace(/\)$/, "")
                .replace(/^getPrettyURI/, "")
                .replace(
                  /^(\s*\(uri\) \{\n)/,
                  `$1    if (new RegExp(\`(\$\{BROWSER_NEW_TAB_URL\}|\$\{HomePage.get(this._win)\})\`, "i").test(uri)) return "";\n`
                )}`
            );
          }
        }
      };

      if (gBrowserInit.delayedStartupFinished) {
        cardPreviewInit();
      } else {
        let delayedListener = (subject, topic) => {
          if (
            topic == "browser-delayed-startup-finished" &&
            subject == window
          ) {
            Services.obs.removeObserver(delayedListener, topic);
            cardPreviewInit();
          }
        };
        Services.obs.addObserver(
          delayedListener,
          "browser-delayed-startup-finished"
        );
      }
    }

    get owner() {
      let owner = this._owner?.deref();
      if (owner && !owner.closing) {
        return owner;
      }
      return null;
    }

    set owner(owner) {
      if (owner) {
        this._owner = new WeakRef(owner);
      } else {
        this._owner = null;
      }
    }

    get container() {
      return gBrowser.tabContainer;
    }

    set attention(val) {
      if (val == this.hasAttribute("attention")) {
        return;
      }

      this.toggleAttribute("attention", val);
      gBrowser._tabAttrModified(this, ["attention"]);
    }

    set undiscardable(val) {
      if (val == this.hasAttribute("undiscardable")) {
        return;
      }

      this.toggleAttribute("undiscardable", val);
      gBrowser._tabAttrModified(this, ["undiscardable"]);
    }

    set _visuallySelected(val) {
      if (val == this.hasAttribute("visuallyselected")) {
        return;
      }

      this.toggleAttribute("visuallyselected", val);
      gBrowser._tabAttrModified(this, ["visuallyselected"]);
    }

    set _selected(val) {
      // in e10s we want to only pseudo-select a tab before its rendering is done, so that
      // the rest of the system knows that the tab is selected, but we don't want to update its
      // visual status to selected until after we receive confirmation that its content has painted.
      if (val) {
        this.setAttribute("selected", "true");
      } else {
        this.removeAttribute("selected");
      }

      // If we're non-e10s we need to update the visual selection at the same
      // time, otherwise AsyncTabSwitcher will take care of this.
      if (!gMultiProcessBrowser) {
        this._visuallySelected = val;
      }
    }

    get pinned() {
      return this.hasAttribute("pinned");
    }

    get isOpen() {
      return (
        this.isConnected && !this.closing && this != FirefoxViewHandler.tab
      );
    }

    get visible() {
      return this.isOpen && !this.hidden && !this.group?.collapsed;
    }

    get hidden() {
      // This getter makes `hidden` read-only
      return super.hidden;
    }

    get muted() {
      return this.hasAttribute("muted");
    }

    get multiselected() {
      return this.hasAttribute("multiselected");
    }

    get userContextId() {
      return this.hasAttribute("usercontextid")
        ? parseInt(this.getAttribute("usercontextid"))
        : 0;
    }

    get soundPlaying() {
      return this.hasAttribute("soundplaying");
    }

    get pictureinpicture() {
      return this.hasAttribute("pictureinpicture");
    }

    get activeMediaBlocked() {
      return this.hasAttribute("activemedia-blocked");
    }

    get undiscardable() {
      return this.hasAttribute("undiscardable");
    }

    get isEmpty() {
      // Determines if a tab is "empty", usually used in the context of determining
      // if it's ok to close the tab.
      if (this.hasAttribute("busy")) {
        return false;
      }

      if (this.hasAttribute("customizemode")) {
        return false;
      }

      let browser = this.linkedBrowser;
      if (!isBlankPageURL(browser.currentURI.spec)) {
        return false;
      }

      if (!BrowserUIUtils.checkEmptyPageOrigin(browser)) {
        return false;
      }

      if (browser.canGoForward || browser.canGoBack) {
        return false;
      }

      return true;
    }

    get lastAccessed() {
      return this._lastAccessed == Infinity ? Date.now() : this._lastAccessed;
    }

    /**
     * Returns a timestamp which attempts to represent the last time the user saw this tab.
     * If the tab has not been active in this session, any lastAccessed is used. We
     * differentiate between selected and explicitly visible; a selected tab in a hidden
     * window is last seen when that window and tab were last visible.
     * We use the application start time as a fallback value when no other suitable value
     * is available.
     */
    get lastSeenActive() {
      const isForegroundWindow =
        this.ownerGlobal ==
        BrowserWindowTracker.getTopWindow({ allowPopups: true });
      // the timestamp for the selected tab in the active window is always now
      if (isForegroundWindow && this.selected) {
        return Date.now();
      }
      if (this._lastSeenActive) {
        return this._lastSeenActive;
      }

      if (
        !this._lastAccessed ||
        this._lastAccessed >= this.container.startupTime
      ) {
        // When the tab was created this session but hasn't been seen by the user,
        // default to the application start time.
        return this.container.startupTime;
      }
      // The tab was restored from a previous session but never seen.
      // Use the lastAccessed as the best proxy for when the user might have seen it.
      return this._lastAccessed;
    }

    get _overPlayingIcon() {
      return (
        this.soundPlayingIcon?.matches(":hover") ||
        (this.overlayIcon?.matches(":hover") &&
          (this.soundPlaying || this.muted || this.activeMediaBlocked))
      );
    }

    get soundPlayingIcon() {
      return this.querySelector(".tab-icon-sound");
    }

    get overlayIcon() {
      return this.querySelector(".tab-icon-overlay");
    }

    get throbber() {
      return this.querySelector(".tab-throbber");
    }

    get iconImage() {
      return this.querySelector(".tab-icon-image");
    }

    get sharingIcon() {
      return this.querySelector(".tab-sharing-icon-overlay");
    }

    get textLabel() {
      return this.querySelector(".tab-label");
    }

    get closeButton() {
      return this.querySelector(".tab-close-button");
    }

    get group() {
      if (this.parentElement?.tagName == "tab-group") {
        return this.parentElement;
      }
      return null;
    }

    updateLastAccessed(aDate) {
      this._lastAccessed = this.selected ? Infinity : aDate || Date.now();
    }

    updateLastSeenActive() {
      this._lastSeenActive = Date.now();
    }

    updateLastUnloadedByTabUnloader() {
      this._lastUnloaded = Date.now();
      Glean.browserEngagement.tabUnloadCount.add(1);
    }

    recordTimeFromUnloadToReload() {
      if (!this._lastUnloaded) {
        return;
      }

      const diff_in_msec = Date.now() - this._lastUnloaded;
      Services.telemetry
        .getHistogramById("TAB_UNLOAD_TO_RELOAD")
        .add(diff_in_msec / 1000);
      Glean.browserEngagement.tabReloadCount.add(1);
      delete this._lastUnloaded;
    }

    _updatePreviewPanelText(popupShowing = false) {
      if (!this.container._showCardPreviews) {
        return;
      }

      const { previewPanel } = this.container;

      if (
        !previewPanel ||
        (!popupShowing &&
          !["open", "showing"].includes(previewPanel._panel.state))
      ) {
        return;
      }

      let tab = previewPanel._tab;
      if (!tab || !gBrowser._showTabCardPreview) {
        return;
      }

      let id, args, raw;
      let attributeName = "label";
      let { linkedBrowser } = tab;
      const contextTabInSelection = gBrowser.selectedTabs.includes(tab);
      const tabCount = contextTabInSelection ? gBrowser.selectedTabs.length : 1;
      if (tab.mOverCloseButton) {
        id = "tabbrowser-close-tabs-button";
        attributeName = "tooltiptext";
        args = { tabCount };
      } else if (tab._overPlayingIcon) {
        args = { tabCount };
        if (contextTabInSelection) {
          id = linkedBrowser.audioMuted
            ? "tabbrowser-unmute-tab-audio-tooltip"
            : "tabbrowser-mute-tab-audio-tooltip";
          const keyElem = document.getElementById("key_toggleMute");
          args.shortcut = ShortcutUtils.prettifyShortcut(keyElem);
        } else if (tab.hasAttribute("activemedia-blocked")) {
          id = "tabbrowser-unblock-tab-audio-tooltip";
        } else {
          id = linkedBrowser.audioMuted
            ? "tabbrowser-unmute-tab-audio-background-tooltip"
            : "tabbrowser-mute-tab-audio-background-tooltip";
        }
      } else {
        raw = previewPanel._displayTitle;
      }
      let title = previewPanel._panel.querySelector(".tab-preview-title");
      if (raw) {
        title.textContent = raw ?? "";
      } else if (id) {
        let localized = "";
        let [msg] = gBrowser.tabLocalization.formatMessagesSync([{ id, args }]);
        if (attributeName === "value") {
          localized = msg.value;
        } else if (msg.attributes) {
          let attr = msg.attributes.find(attr => attr.name === attributeName);
          if (attr?.value) {
            localized = attr.value;
          }
        }
        title.textContent = localized ?? "";
      } else {
        title.textContent = "";
      }
      let url = previewPanel._panel.querySelector(".tab-preview-uri");
      url.textContent = previewPanel._displayURI;
    }

    on_mouseover(event) {
      if (event.target.classList.contains("tab-close-button")) {
        this.mOverCloseButton = true;
      }
      if (this._overPlayingIcon) {
        const selectedTabs = gBrowser.selectedTabs;
        const contextTabInSelection = selectedTabs.includes(this);
        const affectedTabsLength = contextTabInSelection
          ? selectedTabs.length
          : 1;
        let stringID;
        if (this.hasAttribute("activemedia-blocked")) {
          stringID = "browser-tab-unblock";
        } else {
          stringID = this.linkedBrowser.audioMuted
            ? "browser-tab-unmute"
            : "browser-tab-mute";
        }
        this.setSecondaryTabTooltipLabel(stringID, {
          count: affectedTabsLength,
        });
      }

      this._updatePreviewPanelText();

      if (!this.visible) {
        return;
      }

      let tabToWarm = this.mOverCloseButton
        ? gBrowser._findTabToBlurTo(this)
        : this;
      gBrowser.warmupTab(tabToWarm);

      // If the previous target wasn't part of this tab then this is a mouseenter event.
      if (!this.contains(event.relatedTarget)) {
        this._mouseenter();
      }
    }

    on_mouseout(event) {
      if (event.target.classList.contains("tab-close-button")) {
        this.mOverCloseButton = false;
      }
      if (
        event.target == this.overlayIcon ||
        event.target == this.soundPlayingIcon
      ) {
        this.setSecondaryTabTooltipLabel(null);
      }

      // If the new target is not part of this tab then this is a mouseleave event.
      if (!this.contains(event.relatedTarget)) {
        this._mouseleave();
      }
    }

    on_dragstart(event) {
      // We use "failed" drag end events that weren't cancelled by the user
      // to detach tabs. Ensure that we do not show the drag image returning
      // to its point of origin when this happens, as it makes the drag
      // finishing feel very slow.
      event.dataTransfer.mozShowFailAnimation = false;
      if (event.eventPhase == Event.CAPTURING_PHASE) {
        this.style.MozUserFocus = "";
      } else if (
        this.mOverCloseButton ||
        gSharedTabWarning.willShowSharedTabWarning(this)
      ) {
        event.stopPropagation();
      }
    }

    on_mousedown(event) {
      let eventMaySelectTab = true;
      let tabContainer = this.container;

      if (
        tabContainer._closeTabByDblclick &&
        event.button == 0 &&
        event.detail == 1
      ) {
        this._selectedOnFirstMouseDown = this.selected;
      }

      if (this.selected) {
        this.style.MozUserFocus = "ignore";
      } else if (
        event.target.classList.contains("tab-close-button") ||
        event.target.classList.contains("tab-icon-sound") ||
        event.target.classList.contains("tab-icon-overlay")
      ) {
        eventMaySelectTab = false;
      }

      if (event.button == 1) {
        gBrowser.warmupTab(gBrowser._findTabToBlurTo(this));
      }

      if (event.button == 0) {
        let shiftKey = event.shiftKey;
        let accelKey = event.getModifierState("Accel");
        if (shiftKey) {
          eventMaySelectTab = false;
          const lastSelectedTab = gBrowser.lastMultiSelectedTab;
          if (!accelKey) {
            gBrowser.selectedTab = lastSelectedTab;

            // Make sure selection is cleared when tab-switch doesn't happen.
            gBrowser.clearMultiSelectedTabs();
          }
          gBrowser.addRangeToMultiSelectedTabs(lastSelectedTab, this);
        } else if (accelKey) {
          // Ctrl (Cmd for mac) key is pressed
          eventMaySelectTab = false;
          if (this.multiselected) {
            gBrowser.removeFromMultiSelectedTabs(this);
          } else if (this != gBrowser.selectedTab) {
            gBrowser.addToMultiSelectedTabs(this);
            gBrowser.lastMultiSelectedTab = this;
          }
        } else if (!this.selected && this.multiselected) {
          gBrowser.lockClearMultiSelectionOnce();
        }
      }

      if (gSharedTabWarning.willShowSharedTabWarning(this)) {
        eventMaySelectTab = false;
      }

      if (eventMaySelectTab) {
        super.on_mousedown(event);
      }
    }

    on_mouseup() {
      // Make sure that clear-selection is released.
      // Otherwise selection using Shift key may be broken.
      gBrowser.unlockClearMultiSelection();

      this.style.MozUserFocus = "";
    }

    on_click(event) {
      if (event.button != 0) {
        return;
      }

      if (event.getModifierState("Accel") || event.shiftKey) {
        return;
      }

      let onClose = event.target.classList.contains("tab-close-button");
      let onSound = event.target.classList.contains("tab-icon-sound");
      let onOverlay = event.target.classList.contains("tab-icon-overlay");

      if (
        gBrowser.multiSelectedTabsCount > 0 &&
        !onClose &&
        !onSound &&
        !onOverlay
      ) {
        // Tabs were previously multi-selected and user clicks on a tab
        // without holding Ctrl/Cmd Key
        gBrowser.clearMultiSelectedTabs();
      }

      if (onSound || onOverlay) {
        if (this.activeMediaBlocked) {
          if (this.multiselected) {
            gBrowser.resumeDelayedMediaOnMultiSelectedTabs(this);
          } else {
            this.resumeDelayedMedia();
          }
        } else if (onSound || this.soundPlaying || this.muted) {
          if (this.multiselected) {
            gBrowser.toggleMuteAudioOnMultiSelectedTabs(this);
          } else {
            this.toggleMuteAudio();
          }
        }
        return;
      }

      if (onClose) {
        if (this.multiselected) {
          gBrowser.removeMultiSelectedTabs();
        } else {
          gBrowser.removeTab(this, {
            animate: true,
            triggeringEvent: event,
          });
        }
        // This enables double-click protection for the tab container
        // (see tabbrowser-tabs 'click' handler).
        gBrowser.tabContainer._blockDblClick = true;
      }
    }

    on_dblclick(event) {
      if (event.button != 0) {
        return;
      }

      // for the one-close-button case
      if (event.target.classList.contains("tab-close-button")) {
        event.stopPropagation();
      }

      let tabContainer = this.container;
      if (
        tabContainer._closeTabByDblclick &&
        this._selectedOnFirstMouseDown &&
        this.selected &&
        !(
          event.target.classList.contains("tab-icon-sound") ||
          event.target.classList.contains("tab-icon-overlay")
        )
      ) {
        gBrowser.removeTab(this, {
          animate: true,
          triggeringEvent: event,
        });
      }
    }

    on_animationend(event) {
      if (event.target.classList.contains("tab-loading-burst")) {
        this.removeAttribute("bursting");
      }
    }

    _mouseenter() {
      this._hover = true;

      if (this.selected) {
        this.container._handleTabSelect();
      } else if (this.linkedPanel) {
        this.linkedBrowser.unselectedTabHover(true);
      }

      // Prepare connection to host beforehand.
      SessionStore.speculativeConnectOnTabHover(this);

      this.dispatchEvent(new CustomEvent("TabHoverStart", { bubbles: true }));
    }

    _mouseleave() {
      if (!this._hover) {
        return;
      }
      this._hover = false;
      if (this.linkedPanel && !this.selected) {
        this.linkedBrowser.unselectedTabHover(false);
      }
      this.dispatchEvent(new CustomEvent("TabHoverEnd", { bubbles: true }));
    }

    setSecondaryTabTooltipLabel(l10nID, l10nArgs) {
      this.querySelector(".tab-secondary-label").toggleAttribute(
        "showtooltip",
        l10nID
      );

      const tooltipEl = this.querySelector(".tab-icon-sound-tooltip-label");

      if (l10nArgs) {
        tooltipEl.setAttribute("data-l10n-args", JSON.stringify(l10nArgs));
      } else {
        tooltipEl.removeAttribute("data-l10n-args");
      }
      if (l10nID) {
        tooltipEl.setAttribute("data-l10n-id", l10nID);
      } else {
        tooltipEl.removeAttribute("data-l10n-id");
      }
      // TODO(Itiel): Maybe simplify this when bug 1830989 lands
    }

    resumeDelayedMedia() {
      if (this.activeMediaBlocked) {
        this.removeAttribute("activemedia-blocked");
        this.linkedBrowser.resumeMedia();
        gBrowser._tabAttrModified(this, ["activemedia-blocked"]);
      }
    }

    toggleMuteAudio(aMuteReason) {
      let browser = this.linkedBrowser;
      if (browser.audioMuted) {
        if (this.linkedPanel) {
          // "Lazy Browser" should not invoke its unmute method
          browser.unmute();
        }
        this.removeAttribute("muted");
      } else {
        if (this.linkedPanel) {
          // "Lazy Browser" should not invoke its mute method
          browser.mute();
        }
        this.toggleAttribute("muted", true);
      }
      this.muteReason = aMuteReason || null;

      gBrowser._tabAttrModified(this, ["muted"]);
      this._updatePreviewPanelText();
    }

    setUserContextId(aUserContextId) {
      if (aUserContextId) {
        if (this.linkedBrowser) {
          this.linkedBrowser.setAttribute("usercontextid", aUserContextId);
        }
        this.setAttribute("usercontextid", aUserContextId);
      } else {
        if (this.linkedBrowser) {
          this.linkedBrowser.removeAttribute("usercontextid");
        }
        this.removeAttribute("usercontextid");
      }

      ContextualIdentityService.setTabStyle(this);
    }

    updateA11yDescription() {
      let prevDescTab = gBrowser.tabContainer.querySelector(
        "tab[aria-describedby]"
      );
      if (prevDescTab) {
        // We can only have a description for the focused tab.
        prevDescTab.removeAttribute("aria-describedby");
      }
      let desc = document.getElementById("tabbrowser-tab-a11y-desc");
      desc.textContent = gBrowser.getTabTooltip(this, false);
      this.setAttribute("aria-describedby", "tabbrowser-tab-a11y-desc");
    }

    on_focus() {
      this.updateA11yDescription();
    }

    on_AriaFocus() {
      this.updateA11yDescription();
    }
  }

  customElements.define("tabbrowser-tab", MozTabbrowserTab, {
    extends: "tab",
  });
}
