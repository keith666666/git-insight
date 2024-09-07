document.addEventListener("DOMContentLoaded", function () {
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
});

function extractRepoInfo(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  return match ? { owner: match[1], repo: match[2] } : null;
}

function fetchRepoData(owner, repo) {
  fetch(`https://api.github.com/repos/${owner}/${repo}`)
    .then((response) => response.json())
    .then((data) => {
      document.getElementById("repo-name").textContent = data.full_name;
      document.getElementById("repo-creator").textContent = data.owner.login;
      document.getElementById("repo-created").textContent = new Date(
        data.created_at
      ).toLocaleDateString();
      document.getElementById("repo-stars").textContent = data.stargazers_count;
      document.getElementById("repo-issues").textContent =
        data.open_issues_count;
    })
    .catch((error) => {
      console.error("Error fetching repo data:", error);
      document.getElementById("repo-info").innerHTML =
        "<p>Error fetching repository data.</p>";
    });
}
