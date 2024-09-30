// ==UserScript==
// @name MAM Ignore Torrents
// @namespace    Humdinger
// @author       Humdinger
// @description  Adds thumbs up/down icons to the torrent rows to allow for managing ignored torrents
// @match        https://www.myanonamouse.net/tor/browse.php*
// @match        https://www.myanonamouse.net/t/*
// @version      0.5.8
// @icon https://cdn.myanonamouse.net/imagebucket/204586/MouseyIcon.png
// @homepage     https://www.myanonamouse.net
// @license      MIT
// @grant        GM_getValue
// @grant        GM_setValue
// @downloadURL https://github.com/TheRealHumdinger/MAM-Ignore-Torrents/raw/main/MAMIgnoreTorrents.user.js
// @updateURL https://github.com/TheRealHumdinger/MAM-Ignore-Torrents/raw/main/MAMIgnoreTorrents.user.js
// ==/UserScript==
(function () {
  "use strict";

  const DEBUG = 1; // Debugging mode on (1) or off (0)
  if (DEBUG > 0) console.log("Starting Ignored Torrents script");
  var listOfIgnoredTorrents = GM_getValue("GM_IgnoredTorrents", []);

  if (window.location.href.includes("/tor/browse.php")) {
    var ignored = 0; // count of torrents ignored
    var hideIgnoredTorrents = GM_getValue("GM_HideIgnoredTorrents", false);
    var ignoredBG = GM_getValue("GM_IgnoredBG", "#220"); // Background color for non-removed, ignored torrents
    // debugger

    // Add the observer to the main container div with id 'ssr'
    // This is to detect when the new torrent table is added to the page
    // The actions performed are reset the counts, remove the elements,
    // add the remove buttons, and remove the "Torrents added" rows
    const observableDiv = document.querySelector('div#ssr');
    const observer = new MutationObserver((mutationsList, observer) => {
      for (let mutation of mutationsList) {
        if (Array.from(mutation.addedNodes).some(node => node.classList && node.classList.contains('newTorTable'))) {
          console.log('New torrent table added.');
          ignored = 0;

          document.getElementById('ignoringSpan').textContent = '';
          addRemoveButtons();
          removeTorrentAdded();
          addMassActionButtons();
        }
      }
    });
    observer.observe(observableDiv, { childList: true });
    // observer.disconnect();

    let el = document.querySelector("div.blockFoot");
    var span = document.createElement("span");
    span.textContent = "";
    span.style.fontSize = "18px";
    span.id = "ignoringSpan";
    el.appendChild(span);

    // Create show/hide ignored torrents button
    var showHideButton = document.createElement("h1");
    if (hideIgnoredTorrents) {
      showHideButton.textContent = "Show Ignored Torrents";
    } else {
      showHideButton.textContent = "Remove Ignored Torrents";
    }
    showHideButton.id = "ignoredToggle";
    showHideButton.classList.add("torFormButton");
    showHideButton.role = "button";
    showHideButton.onclick = function () {
      if (hideIgnoredTorrents) {
        hideIgnoredTorrents = false;
        showHideButton.textContent = "Remove Ignored Torrents";
        // document.getElementById("myBGColorInput").style.display = "";
        GM_setValue("GM_HideIgnoredTorrents", hideIgnoredTorrents);
        window.location.reload();
      } else {
        hideIgnoredTorrents = true;
        showHideButton.textContent = "Show Ignored Torrents";
        document.getElementById("myBGColorInput").style.display = "none";
        GM_setValue("GM_HideIgnoredTorrents", hideIgnoredTorrents);
        removeIgnoredTorrents();
      }
    };
    document.getElementById("searchReset").insertAdjacentElement("afterend", showHideButton);

    var colorInput = document.createElement("input");
    colorInput.classList.add("torFormButton");
    colorInput.type = "color";
    colorInput.value = ignoredBG;
    colorInput.id = "myBGColorInput";
    if (hideIgnoredTorrents) {
      colorInput.style.display = "none";
    }
    colorInput.onchange = function () {
      GM_setValue("GM_IgnoredBG", colorInput.value);
      for (let row of document.querySelector("table.newTorTable").querySelectorAll('[id^="tdr"]')) {
        if (listOfIgnoredTorrents.includes(row.id.substring(4))) {
          row.style.backgroundColor = colorInput.value;
        }
      }
    };
    document.getElementById("ignoredToggle").insertAdjacentElement("afterend", colorInput);

    var colorInputDiv = document.createElement("div");
    colorInputDiv.id = "myBGColorInputDiv";
    colorInputDiv.style.position = "relative";
    colorInputDiv.style.display = "inline-block";

    var colorInputTooltip = document.createElement("span");
    colorInputTooltip.textContent = "Set background color for ignored torrents";
    colorInputTooltip.style = "font-size: 14px; position: absolute; width: 250px; top: 20px; margin-left: -160px; color: white; background-color: black; padding: 3px; border-radius: 6px; text-align: center; cursor: help; display: inline-block; visibility: hidden;";
    colorInput.onmouseover = function () {
      colorInputTooltip.style.visibility = "visible";
    };
    colorInput.onmouseout = function () {
      colorInputTooltip.style.visibility = "hidden";
    };
    colorInputDiv.appendChild(colorInputTooltip);
    document.getElementById("myBGColorInput").insertAdjacentElement("afterend", colorInputDiv);
  }

  if (window.location.href.includes("/t/")) {
    var torrentId = window.location.href.split("/").pop();
    if (DEBUG > 0) console.log("Torrent ID: " + torrentId);
    // Fix suggested by pajn to get the correct div for the thumbs up/down icon
    var myDiv = document.querySelector('div.torDetRow:has(a[href^="/tor/upload.php?"]) div');

    let newImg = document.createElement("img");
    if (listOfIgnoredTorrents.includes(torrentId)) {
      newImg.src = "https://cdn.myanonamouse.net/imagebucket/204586/12008_thumbs_up_icon.png";
    } else {
      newImg.src = "https://cdn.myanonamouse.net/imagebucket/204586/12014_thumbs_down_icon.png";
    }
    newImg.onclick = function () {
      ignoreTorrent(this, torrentId);
    };
    newImg.style.cursor = "pointer";
    newImg.style.width = "18px";
    newImg.style.height = "18px";
    myDiv.insertBefore(newImg, myDiv.querySelectorAll("br")[1]);
  }

  // The function that removes the "Torrents added" rows from the table
  // these rows are really unnecessary and just take up space
  // and are better removed to make the table look cleaner
  // If you want to keep these rows, you can comment out this function and the call to it
  // in the observer callback
  function removeTorrentAdded() {
    let rows = document.querySelector("table.newTorTable").querySelectorAll('tr');
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].children[0].textContent.includes("Torrents added")) {
        rows[i].remove();
      }
    }
  }

  function addMassActionButtons() {
    let el = document.querySelector("div#massActions");
    var ignoreAllButton = document.createElement("button");
    ignoreAllButton.textContent = "Ignore All";
    //ignoreAllButton.classList.add("torFormButton");
    //ignoreAllButton.role = "button";
    ignoreAllButton.onclick = function () {
      var rows = document.querySelector("table.newTorTable").querySelectorAll('[id^="tdr"]');
      for (let i = rows.length - 1; i > -1; i--) {
        if (!listOfIgnoredTorrents.includes(rows[i].id.substring(4))) {
          ignoreTorrent(rows[i].children[3].children[2], rows[i].id.substring(4));
        }
      }
    };

    var unIgnoreAllButton = document.createElement("button");
    unIgnoreAllButton.textContent = "Unignore All";
    //unIgnoreAllButton.classList.add("torFormButton");
    //unIgnoreAllButton.role = "button";
    unIgnoreAllButton.onclick = function () {
      var rows = document.querySelector("table.newTorTable").querySelectorAll('[id^="tdr"]');
      for (let i = rows.length - 1; i > -1; i--) {
        if (listOfIgnoredTorrents.includes(rows[i].id.substring(4))) {
          ignoreTorrent(rows[i].children[3].children[2], rows[i].id.substring(4));
        }
      }
    };
    el.appendChild(document.createElement("br"));
    el.appendChild(ignoreAllButton);
    el.appendChild(document.createElement("br"));
    el.appendChild(unIgnoreAllButton);
  }
  // This is the action performed when the thumbs up/down icon is clicked on a torrent
  // If thumbs down, the torrent is added to the list of ignored torrents and the icon is changed to thumbs up
  // then the torrent is removed from the table if the hideIgnoredTorrents setting is true
  // If thumbs up, the torrent is removed from the list of ignored torrents and the icon is changed to thumbs down
  function ignoreTorrent(target, id) {
    if (target.src.includes("thumbs_down_icon")) {
      listOfIgnoredTorrents.push(id);
      GM_setValue("GM_IgnoredTorrents", listOfIgnoredTorrents);
      target.src = "https://cdn.myanonamouse.net/imagebucket/204586/12008_thumbs_up_icon.png";
      target.parentElement.parentElement.style.backgroundColor = ignoredBG;
      if (hideIgnoredTorrents) {
        ignored += 1;
        target.parentElement.parentElement.remove();
      }
    } else {
      listOfIgnoredTorrents = listOfIgnoredTorrents.filter((item) => item !== id);
      GM_setValue("GM_IgnoredTorrents", listOfIgnoredTorrents);
      target.src = "https://cdn.myanonamouse.net/imagebucket/204586/12014_thumbs_down_icon.png";
      target.parentElement.parentElement.style.backgroundColor = "";
    }
  }

  // This function adds the thumbs up/down icons to the table rows in the torrent search
  // It also removes the rows that are in the list of ignored torrents if the hideIgnoredTorrents setting is true
  // This function is called by the observer when the new torrent table is added to the page
  function addRemoveButtons() {
    let rows = document.querySelector("table.newTorTable").querySelectorAll('[id^="tdr"]');

    for (let i = 0; i < rows.length; i++) {
      if (listOfIgnoredTorrents.includes(rows[i].id.substring(4)) && hideIgnoredTorrents) {
        ignored += 1;
        rows[i].remove();
      } else {
        let tdEl = rows[i].children[3];
        let newImg = document.createElement("img");
        if (listOfIgnoredTorrents.includes(rows[i].id.substring(4))) {
          rows[i].style.backgroundColor = ignoredBG;
          newImg.src = "https://cdn.myanonamouse.net/imagebucket/204586/12008_thumbs_up_icon.png";
        } else {
          newImg.src = "https://cdn.myanonamouse.net/imagebucket/204586/12014_thumbs_down_icon.png";
        }
        newImg.onclick = function () {
          console.log(this.parentElement.parentElement.id.substring(4));
          ignoreTorrent(this, this.parentElement.parentElement.id.substring(4));
        };
        newImg.style.cursor = "pointer";
        newImg.style.width = "18px";
        newImg.style.height = "18px";
        tdEl.appendChild(newImg);
      }
    }
    if (ignored > 0) {
      span.textContent = ` ${ignored} Ignored Torrents. `;
    }
  }

  // This function removes the rows that are in the list of ignored torrents
  // The observer calls this function when the hideIgnoredTorrents setting is true
  function removeIgnoredTorrents() {
    let rows = document.querySelector("table.newTorTable").querySelectorAll('[id^="tdr"]');
    for (let i = 0; i < rows.length; i++) {
      if (listOfIgnoredTorrents.includes(rows[i].id.substring(4))) {
        ignored += 1;
        rows[i].remove();
      }
    }
    if (ignored > 0) {
      span.textContent = ` ${ignored} Ignored Torrents. `;
    }
  }

  if (DEBUG > 0) console.log("Ignore Torrents script done.");
})();
