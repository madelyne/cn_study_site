const params = new URLSearchParams(window.location.search);
if (!params.get("PROLIFIC_PID")) {
  window.location.replace("https://google.com/");
}

document.addEventListener('DOMContentLoaded', () => {
      const consentSection = document.getElementById('consentSection');
      const infoSection = document.getElementById('infoSection');
      const instrucSection = document.getElementById('instrucSection');
      const formSection = document.getElementById('formSection');

      const consentButton = document.getElementById('consentButton');
      const infoButton = document.getElementById('infoButton');
      const instrucButton = document.getElementById('instrucButton');

      consentButton.addEventListener('click', () => {
        // Read all consent question values
        const consent = document.querySelector('input[name="consent"]:checked')?.value;

        // If "yes" is checked, continue; otherwise, redirect to Prolific
        if (consent === 'yes') {
          consentSection.style.display = 'none';
          infoSection.style.display = 'block';
        } else {
          window.location.href = "https://app.prolific.com/submissions/complete?cc=RETURN_CODE";
        }
      });

      infoButton.addEventListener('click', () => {
        infoSection.style.display = 'none';
        instrucSection.style.display = 'block';
      });

      instrucButton.addEventListener('click', () => {
        instrucSection.style.display = 'none';
	formSection.style.display = 'block';
      });
    });


 const APPROVED_FILES = [
        "data/ad-impressions.js",
        "data/community-note-rating.js",
        "data/community-note.js",
        "data/following.js",
        "data/like.js",
        "data/personalization.js",
        "data/profile.js",
        "data/tweets.js"
    ];

let approvedBlobs = [];
let accessToken = null;

  const previewPane = document.getElementById("previewPane");
  const zipInput = document.getElementById("zipFile");
  const pidInput = document.getElementById("pid");
  const previewBtn = document.getElementById("previewBtn");
  const submitBtn = document.getElementById("submitBtn");


function extractYTDAssignedArray(jsText) {
  // Extracts the array literal from:
  // window.YTD.something.part0 = [ ... ];
  const match = jsText.match(/=\s*(\[[\s\S]*\])\s*;?\s*$/);
  if (!match) {
    throw new Error("Could not extract data array");
  }
  return JSON.parse(match[1]);
}

function countCommunityNoteRatings(jsText) {
  const arr = extractYTDAssignedArray(jsText);
  return Array.isArray(arr) ? arr.length : 0;
}

function hasAuthoredNotes(jsText) {
  const arr = extractYTDAssignedArray(jsText);
  return Array.isArray(arr) && arr.length > 0;
}


previewBtn.addEventListener("click", async () => {
  const file = zipInput.files[0];
  if (!file) return alert("Please select a ZIP file first.");

  const zip = await JSZip.loadAsync(file);
  approvedBlobs = [];
  previewPane.innerHTML = "";
//  submitBtn.disabled = true;

  const foundFiles = new Set();

  let ratingCount = 0;
  let wroteAnyNotes = false;

  for (const [zipPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    for (const approvedName of APPROVED_FILES) {
      if (zipPath.endsWith(approvedName)) {
        const content = await entry.async("text");
        foundFiles.add(approvedName);

        // --- Eligibility checks ---
        if (approvedName === "data/community-note-rating.js") {
          try {
            ratingCount = countCommunityNoteRatings(content);
          } catch (e) {
            return alert("Could not read Community Note ratings file.");
          }
        }

        if (approvedName === "data/community-note.js") {
          try {
            wroteAnyNotes = hasAuthoredNotes(content);
          } catch (e) {
            return alert("Could not read Community Note author file.");
          }
        }

        approvedBlobs.push({
          name: approvedName.split("/").pop(),
          blob: new Blob([content]),
          path: zipPath
        });

        // --- Preview UI ---
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = zipPath;

        const contentBox = document.createElement("pre");
        contentBox.textContent = content;
        contentBox.style.maxHeight = "250px";
        contentBox.style.overflowY = "auto";

        details.appendChild(summary);
        details.appendChild(contentBox);
        previewPane.appendChild(details);
      }
    }
  }

  // --- Missing files check ---
  const missing = APPROVED_FILES.filter(f => !foundFiles.has(f));
  if (missing.length > 0) {
    return alert(
      "Missing required files:\n\n" + missing.join("\n")
    );
  }

  // --- Eligibility rule ---
  if (ratingCount < 8 && !wroteAnyNotes) {
    alert(
       "Thank you for your interest in this study on Community Notes. In order to participate in this study, you must have an X account enrolled in Community Notes and have either rated 8 notes or written 1 note. Based on your responses, you do not meet the eligibility criteria."
    );

    // Redirect back to Prolific
    window.location.href =
      "https://app.prolific.com/submissions/complete?cc=RETURN_CODE";
    return;
  }

  alert(
    `✅ Preview successful!\n\nRatings: ${ratingCount}\nAuthored notes: ${wroteAnyNotes ? "Yes" : "No"}`
  );

  submitBtn.style.display = "inline-block";

});



// ---------------------
// Step 2: Submit
// ---------------------

const QUALTRICS_URL = "https://princetonsurvey.pdx1.qualtrics.com/jfe/preview/previewId/9821d4ca-f86e-4299-b60b-b9464191a1c7/SV_d0S7H4vCOpvNM0e?Q_CHL=preview&Q_SurveyVersionID=current";

// button (initially hidden in HTML)
const proceedBtn = document.getElementById("proceedBtn");

function makeDir() {
  return `prolific/${crypto.randomUUID()}_${Date.now()}`;
}


submitBtn.addEventListener("click", async () => {
  const pid = pidInput.value.trim();
  if (!pid) return alert("Please enter your Prolific PID.");
  if (approvedBlobs.length === 0) return alert("The file that you selected does not appear to be the ZIP file containing your X account archive. Please select that file.");

  // 1. Create the unique directory name
  const dir = makeDir();

  submitBtn.disabled = true;
  submitBtn.textContent = "Uploading...";

  try {
    // 2. Upload all approved files
    for (const fileObj of approvedBlobs) {
      const res = await fetch(
        "https://csjqyfdhpc.execute-api.us-east-2.amazonaws.com/default/getSignedURLs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dir: dir,              // pass directory instead of pid
            fileName: fileObj.name // raw filename
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to get signed URL");
      const data = await res.json();
      const { uploadUrl } = data;

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: fileObj.blob,
      });

      if (!uploadRes.ok) {
        throw new Error(`Failed to upload ${fileObj.name}`);
      }
    }

    // 3. Upload pid.txt
    const pidRes = await fetch(
      "https://csjqyfdhpc.execute-api.us-east-2.amazonaws.com/default/getSignedURLs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dir: dir,
          fileName: "pid.txt"
        }),
      }
    );

    if (!pidRes.ok) throw new Error("Failed to get signed URL for pid.txt");
    const { uploadUrl: pidUrl } = await pidRes.json();

    const pidUpload = await fetch(pidUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: pid
    });

    if (!pidUpload.ok) {
      throw new Error("Failed to upload pid.txt");
    }

    alert("Files uploaded.");
    proceedBtn.style.display = "block";
    submitBtn.disabled = true; // disable after success
    submitBtn.textContent = "Uploaded";

  } catch (err) {
    console.error(err);
    alert(`Upload error: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Files";
  }
});


proceedBtn.addEventListener("click", () => {
  // Replace page body with a message
  document.body.innerHTML = `
      <div style="font-size: 22px; text-align:center; margin-top: 50px;">
          Taking you to Qualtrics…
      </div>
  `;

  // Redirect after a short pause
  setTimeout(() => {
    window.location.href = QUALTRICS_URL;
  }, 1000);
});

