# cn_study_site

backend data minimization code and frontend web interface for a community notes audit project. 

p.html: consents users, walks them through the archive download and upload process, performs client-side filtering of archive contents (only some js files are required or permitted for analysis, particularly for participants recruited via survey platforms). 

pLandingPage.js: specifies permitted file set, selects files for upload, sanity checks uploaded zip archive (participants must have submitted at least 8 ratings OR written at least 1 note in order to be eligible), and submits eligible files to a secure S3 bucket via signed URL. 
