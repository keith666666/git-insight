document.getElementById("save").addEventListener("click", function () {
  var token = document.getElementById("github-token").value;
  chrome.storage.sync.set(
    {
      githubToken: token,
    },
    function () {
      var status = document.getElementById("status");
      status.textContent = "Options saved.";
      setTimeout(function () {
        status.textContent = "";
      }, 750);
    }
  );
});

// Restore saved token when opening the options page
document.addEventListener("DOMContentLoaded", function () {
  chrome.storage.sync.get(
    {
      githubToken: "",
    },
    function (items) {
      document.getElementById("github-token").value = items.githubToken;
    }
  );
});
