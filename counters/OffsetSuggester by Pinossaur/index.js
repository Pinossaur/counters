import WebSocketManager from './js/socket.js';
const socket = new WebSocketManager(window.location.host);

const settings = {};

const currentOffsetDisplay = {
	container: document.getElementById("currentOffsetDiv"),
	rawElement: document.getElementById("currentOffset"),
	smooth: new CountUp('currentOffset', 0, 0, 0, .5, { useEasing: true, useGrouping: true, separator: " ", decimal: "." }),
};

const lastMapOffsetDisplay = {
	container: document.getElementById("lastMapOffsetDiv"),
	rawElement: document.getElementById("lastMapOffset"),
	smooth: new CountUp('lastMapOffset', 0, 0, 0, .5, { useEasing: true, useGrouping: true, separator: " ", decimal: "." }),
};

const suggestedOffsetDisplay = {
	container: document.getElementById("suggestedOffsetDiv"),
	rawElement: document.getElementById("suggestedOffset"),
	smooth: new CountUp('suggestedOffset', 0, 0, 0, .5, { useEasing: true, useGrouping: true, separator: " ", decimal: "." }),
};

const warningTextElement = document.getElementById("warningText");

var configLoaded = false;

var globalOffsets = [];
var hitErrors = [];

var clientUniversalOffset = undefined;

socket.sendCommand('getSettings', encodeURI(window.COUNTER_PATH));

socket.commands((data) => {
	try {
		const { command, message } = data;
		
		// If the command received is not getSettings, we shouldn't do anything else.
		if (command !== "getSettings") {
			return;
		}
		
		if (settings["currentOffsetEnable"] !== message["currentOffsetEnable"]) {
			settings["currentOffsetEnable"] = message["currentOffsetEnable"];
			
			ShouldDimContainer(currentOffsetDisplay, settings["currentOffsetEnable"]);
		}
		
		if (settings["suggestedOffsetEnable"] !== message["suggestedOffsetEnable"]) {
			settings["suggestedOffsetEnable"] = message["suggestedOffsetEnable"];
			
			ShouldDimContainer(suggestedOffsetDisplay, settings["suggestedOffsetEnable"]);
		}
		
		if (settings["suggestedOffsetColorEnable"] !== message["suggestedOffsetColorEnable"]) {
			settings["suggestedOffsetColorEnable"] = message["suggestedOffsetColorEnable"];
		}
		
		if (settings["resetSuggestionOnUniversalOffsetChange"] !== message["resetSuggestionOnUniversalOffsetChange"]) {
			settings["resetSuggestionOnUniversalOffsetChange"] = message["resetSuggestionOnUniversalOffsetChange"];
		}
		
		if (settings["lastMapOffsetEnable"] !== message["lastMapOffsetEnable"]) {
			settings["lastMapOffsetEnable"] = message["lastMapOffsetEnable"];
			
			ShouldDimContainer(lastMapOffsetDisplay, settings["lastMapOffsetEnable"]);
		}
		
		if (settings["useTextEasing"] !== message["useTextEasing"]) {
			settings["useTextEasing"] = message["useTextEasing"];
		}
		
		if (settings["realtimeOffsetCalculation"] !== message["realtimeOffsetCalculation"]) {
			settings["realtimeOffsetCalculation"] = message["realtimeOffsetCalculation"];
		}
		
		if (settings["warningTextDisplayTime"] !== message["warningTextDisplayTime"]) {
			settings["warningTextDisplayTime"] = message["warningTextDisplayTime"];
		}
		
		configLoaded = true;
	}
	catch (error) {
		console.log(error);
	};
});

socket.api_v2((data) => {
	try {
		// We shouldn't do anything before the config is loaded.
		if (!configLoaded) {
			return;
		}
		
		// If we don't have the client's universal offset, we should fetch it, and update all values that use it.
		if (clientUniversalOffset === undefined) {
			UpdateClientUniversalOffset(data.settings.audio.offset.universal, false);
		}
		
		let currentMapHitErrors = data.play?.hitErrorArray ?? [];
		
		// If we're playing, and the hitErrors array is outdated, we should update it.
		if (IsPlaying(data) && currentMapHitErrors.length >= hitErrors.length) {
			// If we're still playing, even if it's not outdated we shouldn't do anything else.
			if (currentMapHitErrors.length === hitErrors.length) {
				return;
			}
			
			hitErrors = currentMapHitErrors;
			
			// If we don't have realtime calculation enabled, we shouldn't do anything else.
			if (!settings["realtimeOffsetCalculation"]) {
				return;
			}
			
			ShouldUpdateText(lastMapOffsetDisplay, settings["lastMapOffsetEnable"], CalculateMedian(hitErrors));
			
			return;
		}

		UpdateClientUniversalOffset(data.settings.audio.offset.universal);
		
		// If the last played map has no hitErrors, we shouldn't do anything else.
		if (hitErrors.length == 0) {
			return;
		}

		// If the last played map has hit errors, but not enough for a reliable calculation, we should warn the user.
		if (hitErrors.length <= 50) {
			hitErrors = [];
			
			ShowWarningText(warningTextElement, "Not enough hits!");
			
			if (settings["realtimeOffsetCalculation"]) {
				let actualLastMapOffset = 0;
				if (globalOffsets.length !== 0) {
					actualLastMapOffset = globalOffsets[globalOffsets.length - 1];
				}
				
				ShouldUpdateText(lastMapOffsetDisplay, settings["lastMapOffsetEnable"], 0);
			}
			
			return;
		}
		
		let lastMapOffset = CalculateMedian(hitErrors);
		
		hitErrors = [];
		
		globalOffsets.push(lastMapOffset);
		
		UpdateSuggestedOffset();
		
		// If we have realtime calculation enabled we already have the latest offset, so we should only display the last map offset if we don't have it enabled.
		if (!settings["realtimeOffsetCalculation"]) {
			ShouldUpdateText(lastMapOffsetDisplay, settings["lastMapOffsetEnable"], lastMapOffset);
		}
		
		const t1 = performance.now();
	}
	catch (err) {
		console.log(err);
	};
}, [
	"client",
	{
		field: "state",
		keys: ["name"]
	},
	{
		field: "settings",
		keys: [
			{
				field: "audio",
				keys: [
					{ 
						field: "offset",
						keys: ["universal"],
					},
				],
			},
		],
	},
	{
		field: "profile",
		keys: [
			"id",
			{
				field: "banchoStatus",
				keys: ["name"],
			},
		],
	},
	{
		field: "play",
		keys: ["hitErrorArray"],
	},
]);

// This function checks if the client universal offset changed, and resets most offset values based on config.
function UpdateClientUniversalOffset(offset, shouldDisplayWarning = true) {
	// If the offset doesn't change, we shouldn't do anything else.
	if (offset === clientUniversalOffset) {
		return;
	}
	
	clientUniversalOffset = offset;
	
	if (!settings["resetSuggestionOnUniversalOffsetChange"]) {
		ShouldUpdateText(currentOffsetDisplay, settings["currentOffsetEnable"], clientUniversalOffset);
		
		return;
	}
	
	globalOffsets = [];
	
	ShouldUpdateText(currentOffsetDisplay, settings["currentOffsetEnable"], clientUniversalOffset);
	ShouldUpdateText(suggestedOffsetDisplay, settings["suggestedOffsetEnable"], clientUniversalOffset);
	
	if (shouldDisplayWarning) {
		ShowWarningText(warningTextElement, "Suggested offset reset!");
	}
}

// This function is the bulk of the suggested offset calculation logic.
// We calculate the average of the previous map's offsets (doesn't need to be median because all values should have equal weight, as it's validated they are calculated from large enough hitEvent sets) and display it.
function UpdateSuggestedOffset() {
	let suggestedUniversalOffset = clientUniversalOffset;
	
	// If we only have a single global offset, we don't need to calculate any averages.
	if (globalOffsets.length === 1) {
		suggestedUniversalOffset = clientUniversalOffset - globalOffsets[0]
	}
	else if (globalOffsets.length > 1) {
		let averageOffset = CalculateAverage(globalOffsets);
		
		if (averageOffset !== undefined) {
			suggestedUniversalOffset -= averageOffset;
		}
	}

	ShouldUpdateText(suggestedOffsetDisplay, settings["suggestedOffsetEnable"], suggestedUniversalOffset);
}

// This function dims a value's container if's supposed to be disabled, or vice versa.
function ShouldDimContainer(display, enabled) {
	if (!enabled) {
		display.container.style.opacity = "0.25";
		
		return;
	}
	
	display.container.style.opacity = display.container.dataset.baseOpacity;
}

// This function updates a div's text if it's container is enabled, or vice versa. We also check if we should ease in the values or not, and if we should change the value's color or not.
function ShouldUpdateText(display, enabled, value) {
	// If the container is not enabled, we shouldn't do anything else.
	if (!enabled) {
		return;
	}
	
	// If the suggested offset coloring config is enabled, and we are trying to update suggested offset text, we should perform the color adquisition and update logic.
	if (settings["suggestedOffsetColorEnable"] && display.rawElement.id === 'suggestedOffset') {
		let color = GetOffsetColor(value - clientUniversalOffset);
		
		display.rawElement.style.color = color;
	}
	
	// If we're using text easing, we should ease the text.
	if (settings["useTextEasing"]) {
		display.smooth.update(value);
		return;
	}
	
	display.rawElement.innerHTML = value;
}

// This function enables, and shows the warning text.
function ShowWarningText(warningDiv, textContent) {
	warningDiv.textContent = textContent
	warningDiv.classList.add("show");
	
	setTimeout(() => {
		warningDiv.classList.remove("show");
				
		setTimeout(function(){
			warningDiv.textContent = "";
		}, 250);
	}, settings["warningTextDisplayTime"]);
}