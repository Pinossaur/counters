function CalculateMedian(hitEvents) {
	if (hitEvents.length === 0) {
		return 0;
	}
	
	if(hitEvents.length === 1) {
		return hitEvents[0];
	}
	
    let timeOffsets = hitEvents
        .slice()
        .sort((a, b) => a - b);

    let center = Math.floor(timeOffsets.length / 2);

    let medianHitError = timeOffsets.length % 2 == 0
        ? (timeOffsets[center - 1] + timeOffsets[center]) / 2
        : timeOffsets[center];
	
	return Math.round(medianHitError);
}

function CalculateAverage(hitEvents) {
	if (hitEvents.length === 0) {
		return;
	}
	
	if(hitEvents.length === 1) {
		return hitEvents[0];
	}
	
	let averageHitError = hitEvents.reduce((sum, v) => sum + v, 0) / hitEvents.length;
		
	if (isNaN(averageHitError)) {
		return;
	}
	
	return Math.round(averageHitError);
}

function GetOffsetColor(diff, maxDiff = 15) {
    const distance = Math.min(Math.abs(diff), maxDiff);

    const t = distance / maxDiff;

    const r = Math.round(255 * t);
    const g = Math.round(255 * (1 - t));
    const b = 0;

    return `rgb(${r},${g},${b})`;
}

// Function to determine if player is playing. We check if we're playing on stable or lazer because on stable banchoStatus can tell us if we're playing, or watching a replay.
function IsPlaying(data) {
	if (data.client === "stable" && data.profile.id !== -1) {
		return data.profile.banchoStatus.name === "playing"
	}
	
	return data.state.name === "play";
}