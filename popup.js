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
  if (!url) return null;
  const match = url.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/);
  return match ? { owner: match[1], repo: match[2] } : null;
}

async function fetchRepoData(owner, repo) {
  try {
    // Fetch main repository data
    const repoData = await fetchGitHubAPI(`/repos/${owner}/${repo}`);

    // Fetch contributors, languages, latest commit, and participation data in a single call
    const [
      contributorsData,
      languagesData,
      latestCommitData,
      participationData,
    ] = await Promise.all([
      fetchGitHubAPI(`/repos/${owner}/${repo}/contributors?per_page=100`),
      fetchGitHubAPI(`/repos/${owner}/${repo}/languages`),
      fetchGitHubAPI(`/repos/${owner}/${repo}/commits?per_page=1`),
      fetchGitHubAPI(`/repos/${owner}/${repo}/stats/participation`),
    ]);

    // Fetch issues and pull requests separately, limited to 100 each
    const [issuesData, pullsData] = await Promise.all([
      fetchGitHubAPI(`/repos/${owner}/${repo}/issues?state=all&per_page=100`),
      fetchGitHubAPI(`/repos/${owner}/${repo}/pulls?state=all&per_page=100`),
    ]);

    // Fetch release data
    const releasesData = await fetchGitHubAPI(
      `/repos/${owner}/${repo}/releases?per_page=100`
    );

    // Fetch star history data
    const starHistoryData = await fetchStarHistory(owner, repo);

    updateRepoOverview(repoData, contributorsData, issuesData, pullsData);
    updateProjectHealth(
      repoData,
      latestCommitData[0],
      participationData,
      issuesData,
      pullsData
    );
    updateCommunityEngagement(
      repoData,
      contributorsData,
      issuesData,
      pullsData
    );
    updateCodeMetrics(repoData, languagesData);
    updateReleaseManagement(releasesData);
    updateStarHistory(starHistoryData, owner, repo);

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
    } else {
      errorMessage = `Error: ${error.message}`;
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

async function fetchStarHistory(owner, repo) {
  // This is a placeholder. You'll need to implement the actual API call
  // to fetch star history data from star-history.com or GitHub API
  return [];
}

function updateStarHistory(starHistoryData, owner, repo) {
  const container = document.getElementById("star-history-container");
  const img = document.createElement("img");
  img.style.width = "100%";
  img.style.maxWidth = "600px";
  img.style.height = "auto";
  img.alt = "Star History Chart";

  let chartUrl = `https://api.star-history.com/svg?repos=${owner}/${repo}&type=Date`;
  img.src = chartUrl;

  const link = document.createElement("a");
  link.href = `https://star-history.com/#${owner}/${repo}&Date`;
  link.target = "_blank";
  link.appendChild(img);

  container.innerHTML = "";
  container.appendChild(link);
}

function updateRepoOverview(repoData, contributorsData, issuesData, pullsData) {
  safelyUpdateElement("repo-name", repoData.full_name);
  safelyUpdateElement("repo-creator", repoData.owner.login);

  // Calculate time ago for creation date
  const createdDate = new Date(repoData.created_at);
  const now = new Date();
  const timeDiff = now - createdDate;
  const yearsAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 365.25));
  const monthsAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 30.44));
  const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

  let timeAgoString;
  if (yearsAgo > 0) {
    timeAgoString = `${yearsAgo} year${yearsAgo !== 1 ? "s" : ""} ago`;
  } else if (monthsAgo > 0) {
    timeAgoString = `${monthsAgo} month${monthsAgo !== 1 ? "s" : ""} ago`;
  } else {
    timeAgoString = `${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago`;
  }

  safelyUpdateElement(
    "repo-created",
    `${createdDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })} (${timeAgoString})`
  );

  safelyUpdateElement("repo-stars", repoData.stargazers_count);
  safelyUpdateElement("repo-forks", repoData.forks_count);
  safelyUpdateElement("repo-watchers", repoData.subscribers_count);
  safelyUpdateElement("repo-issues", repoData.open_issues_count);
  safelyUpdateElement(
    "repo-contributors",
    contributorsData.length >= 100 ? "100+" : contributorsData.length
  );
}

function updateProjectHealth(
  repoData,
  latestCommit,
  participationData,
  issuesData,
  pullsData
) {
  // Commit Velocity (using last 4 weeks of data from participation stats)
  const recentCommits = participationData.all
    .slice(-4)
    .reduce((a, b) => a + b, 0);
  safelyUpdateElement(
    "commit-velocity",
    `${recentCommits.toLocaleString()} commits in the last 4 weeks`
  );

  // Time Since Last Commit
  if (latestCommit) {
    const lastCommitDate = new Date(latestCommit.commit.author.date);
    const now = new Date();
    const timeDiff = now - lastCommitDate;
    const daysSinceLastCommit = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hoursSinceLastCommit = Math.floor(
      (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutesSinceLastCommit = Math.floor(
      (timeDiff % (1000 * 60 * 60)) / (1000 * 60)
    );

    let timeSinceLastCommit;
    if (daysSinceLastCommit > 0) {
      timeSinceLastCommit = `${daysSinceLastCommit.toLocaleString()} day${
        daysSinceLastCommit !== 1 ? "s" : ""
      }`;
    } else if (hoursSinceLastCommit > 0) {
      timeSinceLastCommit = `${hoursSinceLastCommit.toLocaleString()} hour${
        hoursSinceLastCommit !== 1 ? "s" : ""
      } ${minutesSinceLastCommit} minute${
        minutesSinceLastCommit !== 1 ? "s" : ""
      }`;
    } else {
      timeSinceLastCommit = `${minutesSinceLastCommit} minute${
        minutesSinceLastCommit !== 1 ? "s" : ""
      }`;
    }

    safelyUpdateElement("time-since-last-commit", timeSinceLastCommit);
  } else {
    safelyUpdateElement("time-since-last-commit", "N/A");
  }

  // Issue Resolution Time
  const closedIssues = issuesData.filter((issue) => issue.state === "closed");
  const avgResolutionTime =
    closedIssues.reduce((sum, issue) => {
      return sum + (new Date(issue.closed_at) - new Date(issue.created_at));
    }, 0) / closedIssues.length;
  safelyUpdateElement(
    "avg-issue-resolution-time",
    `${Math.round(
      avgResolutionTime / (1000 * 60 * 60 * 24)
    ).toLocaleString()} days (based on last 100 issues)`
  );

  // Pull Request Merge Time
  const mergedPRs = pullsData.filter((pr) => pr.merged_at);
  let avgMergeTime = 0;
  if (mergedPRs.length > 0) {
    avgMergeTime =
      mergedPRs.reduce((sum, pr) => {
        const mergeTime = new Date(pr.merged_at) - new Date(pr.created_at);
        return sum + (mergeTime > 0 ? mergeTime : 0);
      }, 0) / mergedPRs.length;
  }

  let avgMergeTimeString = "";
  if (avgMergeTime >= 86400000) {
    // More than or equal to 24 hours
    avgMergeTimeString = `${(avgMergeTime / 86400000).toFixed(1)} days`;
  } else if (avgMergeTime >= 3600000) {
    // More than or equal to 1 hour
    avgMergeTimeString = `${(avgMergeTime / 3600000).toFixed(1)} hours`;
  } else {
    avgMergeTimeString = `${(avgMergeTime / 60000).toFixed(1)} minutes`;
  }

  safelyUpdateElement(
    "avg-pr-merge-time",
    mergedPRs.length > 0
      ? `${avgMergeTimeString} (based on last 100 PRs)`
      : "N/A (based on last 100 PRs)"
  );

  // PR Acceptance Rate
  const closedPRs = pullsData.filter((pr) => pr.state === "closed");
  const prAcceptanceRate =
    closedPRs.length > 0
      ? ((mergedPRs.length / closedPRs.length) * 100).toFixed(2)
      : "N/A";
  safelyUpdateElement(
    "pr-acceptance-rate",
    closedPRs.length > 0
      ? `${prAcceptanceRate}% (based on last 100 PRs)`
      : "N/A (based on last 100 PRs)"
  );
}

function updateCommunityEngagement(
  repoData,
  contributorsData,
  issuesData,
  pullsData
) {
  // First-Time Contributors
  const firstTimeContributors = contributorsData.filter(
    (contributor) => contributor.contributions === 1
  );
  safelyUpdateElement("first-time-contributors", firstTimeContributors.length);

  // Top Contributors
  const topContributors = contributorsData
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, 5)
    .map((contributor) => `${contributor.login} (${contributor.contributions})`)
    .join(", ");
  safelyUpdateElement("top-contributors", topContributors);
}

function updateCodeMetrics(repoData, languagesData) {
  safelyUpdateElement(
    "repo-size",
    `${(repoData.size / 1024).toFixed(2).toLocaleString()} MB`
  );
  safelyUpdateElement("primary-language", repoData.language);

  // Calculate total bytes
  const totalBytes = Object.values(languagesData).reduce((a, b) => a + b, 0);

  // Sort languages by percentage in descending order
  const sortedLanguages = Object.entries(languagesData)
    .map(([lang, bytes]) => ({
      name: lang,
      percentage: (bytes / totalBytes) * 100,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  // Format language distribution
  const languageDistribution = sortedLanguages
    .map((lang) => `${lang.name}: ${lang.percentage.toFixed(2)}%`)
    .join("\n");

  safelyUpdateElement("language-distribution", languageDistribution);
}

function updateReleaseManagement(releasesData) {
  // Release Frequency
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recentReleases = releasesData.filter(
    (release) => new Date(release.published_at) > oneYearAgo
  );
  safelyUpdateElement(
    "release-frequency",
    `${recentReleases.length.toLocaleString()} releases in the last year`
  );

  // Latest Release
  if (releasesData.length > 0) {
    const latestRelease = releasesData[0];
    safelyUpdateElement(
      "latest-release",
      `${latestRelease.tag_name} (${new Date(
        latestRelease.published_at
      ).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })})`
    );
  } else {
    safelyUpdateElement("latest-release", "No releases");
  }
}

function safelyUpdateElement(id, value) {
  const element = document.getElementById(id);
  if (element) {
    if (typeof value === "number") {
      element.textContent = value.toLocaleString();
    } else if (value instanceof Date) {
      element.textContent = value.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } else {
      element.textContent = value;
    }
  } else {
    console.warn(`Element with id "${id}" not found`);
  }
}

document.getElementById("toggle-token").addEventListener("click", function () {
  const tokenInput = document.getElementById("github-token");
  if (tokenInput.type === "password") {
    tokenInput.type = "text";
    this.textContent = "Hide";
  } else {
    tokenInput.type = "password";
    this.textContent = "Show";
  }
});
