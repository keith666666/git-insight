chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ cachedData: {} });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchGitHubAPI") {
    fetchGitHubAPI(request.endpoint)
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Indicates that the response is sent asynchronously
  }
});

async function fetchGitHubAPI(endpoint) {
  const cachedData = await chrome.storage.local.get("cachedData");
  const cachedResponse = cachedData.cachedData[endpoint];

  if (cachedResponse && Date.now() - cachedResponse.timestamp < 5 * 60 * 1000) {
    return cachedResponse.data;
  }

  const { githubToken } = await chrome.storage.sync.get("githubToken");

  const headers = new Headers({
    Accept: "application/vnd.github.v3+json",
  });

  if (githubToken) {
    headers.append("Authorization", `token ${githubToken}`);
    console.log("Using GitHub token for authentication"); // Add this line
  } else {
    console.warn("No GitHub token found. Requests may be rate-limited.");
  }

  console.log(`Fetching: https://api.github.com${endpoint}`); // Add this line

  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("API Error:", errorData); // Add this line
    throw new Error(
      `GitHub API request failed: ${response.status} - ${errorData.message}`
    );
  }

  const data = await response.json();
  cachedData.cachedData[endpoint] = { data, timestamp: Date.now() };
  await chrome.storage.local.set({ cachedData: cachedData.cachedData });

  return data;
}
