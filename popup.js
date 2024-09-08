document.addEventListener("DOMContentLoaded", function () {
  const refreshBtn = document.getElementById("refresh-btn");
  refreshBtn.addEventListener("click", refreshData);

  const saveTokenBtn = document.getElementById("save-token");
  saveTokenBtn.addEventListener("click", saveToken);

  loadToken();
  loadData();
});

function saveToken() {
  const token = document.getElementById("github-token").value;
  chrome.storage.sync.set({ githubToken: token }, function () {
    alert("Token saved successfully!");
  });
}

function loadToken() {
  chrome.storage.sync.get("githubToken", function (data) {
    if (data.githubToken) {
      document.getElementById("github-token").value = data.githubToken;
    }
  });
}

function loadData() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const url = tabs[0].url;
    const repoInfo = extractRepoInfo(url);

    if (repoInfo) {
      fetchRepoData(repoInfo.owner, repoInfo.repo);
    } else {
      document.getElementById("repo-info").innerHTML =
        "<p>Not a GitHub repository page.</p>";
    }
  });
}

function refreshData() {
  const refreshBtn = document.getElementById("refresh-btn");
  refreshBtn.textContent = "Refreshing...";
  refreshBtn.disabled = true;

  // Clear cached data
  chrome.storage.local.set({ cachedData: {} }, () => {
    loadData();
  });
}

function extractRepoInfo(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  return match ? { owner: match[1], repo: match[2] } : null;
}

async function fetchRepoData(owner, repo) {
  try {
    const repoData = await fetchGitHubAPI(`/repos/${owner}/${repo}`);
    const contributorsData = await fetchGitHubAPI(
      `/repos/${owner}/${repo}/contributors`
    );
    const languagesData = await fetchGitHubAPI(
      `/repos/${owner}/${repo}/languages`
    );
    const commitsData = await fetchGitHubAPI(
      `/repos/${owner}/${repo}/commits?per_page=100`
    );
    const pullsData = await fetchGitHubAPI(`/repos/${owner}/${repo}/pulls`);
    const branchesData = await fetchGitHubAPI(
      `/repos/${owner}/${repo}/branches`
    );
    const eventsData = await fetchGitHubAPI(
      `/repos/${owner}/${repo}/events?per_page=100`
    );

    updateRepoOverview(repoData);
    updateActivityMetrics(repoData, contributorsData, commitsData, eventsData);
    updateCodeMetrics(repoData, languagesData, branchesData);
    updatePullRequestMetrics(pullsData);

    // Reset refresh button
    const refreshBtn = document.getElementById("refresh-btn");
    refreshBtn.textContent = "Refresh Data";
    refreshBtn.disabled = false;
  } catch (error) {
    console.error("Error fetching repo data:", error);
    let errorMessage = "Error fetching repository data.";
    if (error.message.includes("API rate limit exceeded")) {
      errorMessage =
        "API rate limit exceeded. Please check if your GitHub Personal Access Token is correct and has the necessary permissions.";
    }
    document.getElementById("repo-info").innerHTML = `
      <p>${errorMessage}</p>
      <p>Make sure you've entered a valid GitHub token and saved it.</p>
    `;

    // Reset refresh button
    const refreshBtn = document.getElementById("refresh-btn");
    refreshBtn.textContent = "Refresh Data";
    refreshBtn.disabled = false;
  }
}

async function fetchGitHubAPI(endpoint) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: "fetchGitHubAPI", endpoint },
      (response) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error));
        }
      }
    );
  });
}

function updateRepoOverview(data) {
  document.getElementById("repo-name").textContent = data.full_name;
  document.getElementById("repo-creator").textContent = data.owner.login;
  document.getElementById("repo-created").textContent = new Date(
    data.created_at
  ).toLocaleDateString();
  document.getElementById("repo-stars").textContent = data.stargazers_count;
  document.getElementById("repo-forks").textContent = data.forks_count;
  document.getElementById("repo-watchers").textContent = data.subscribers_count;
  document.getElementById("repo-issues").textContent = data.open_issues_count;
}

function updateActivityMetrics(
  repoData,
  contributorsData,
  commitsData,
  eventsData
) {
  document.getElementById("last-commit").textContent = new Date(
    commitsData[0].commit.author.date
  ).toLocaleDateString();
  document.getElementById("contributors").textContent = contributorsData.length;

  // Calculate commit frequency
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const recentCommits = commitsData.filter(
    (commit) => new Date(commit.commit.author.date) > oneMonthAgo
  );
  const commitFrequency = recentCommits.length;
  document.getElementById(
    "commit-frequency"
  ).textContent = `${commitFrequency} commits in the last month`;

  // Calculate recent activity
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recentEvents = eventsData.filter(
    (event) => new Date(event.created_at) > oneWeekAgo
  );
  const recentActivity = recentEvents.length;
  document.getElementById(
    "recent-activity"
  ).textContent = `${recentActivity} events in the last week`;
}

function updateCodeMetrics(repoData, languagesData, branchesData) {
  document.getElementById("repo-size").textContent = `${(
    repoData.size / 1024
  ).toFixed(2)} MB`;
  document.getElementById("primary-language").textContent = repoData.language;

  // Calculate total bytes
  const totalBytes = Object.values(languagesData).reduce((a, b) => a + b, 0);

  const languageDistribution = Object.entries(languagesData)
    .map(
      ([lang, bytes]) => `${lang}: ${((bytes / totalBytes) * 100).toFixed(2)}%`
    )
    .join(", ");
  document.getElementById("language-distribution").textContent =
    languageDistribution;

  // Add branch count
  document.getElementById("branches").textContent = branchesData.length;
}

function updatePullRequestMetrics(pullsData) {
  document.getElementById("repo-prs").textContent = pullsData.length;
  // Add more pull request metrics calculations
}

// Add more functions for other metrics
