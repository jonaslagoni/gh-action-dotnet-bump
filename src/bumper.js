const path = require('path');
const { promises } = require('fs');
const {
  exitSuccess,
  findPreReleaseId,
  analyseVersionChange,
  bumpVersion,
  commitChanges,
  logInfo,
  setGitConfigs,
  getProjectContent,
  getCurrentVersionCsproj,
  getNewProjectContentCsproj,
  getCurrentVersionAssembly,
  getCommitMessages,
  getRelevantCommitMessages
} = require('./utils');

module.exports = async (
  tagPrefix,
  minorWording,
  majorWording,
  patchWording,
  rcWording,
  skipTag,
  skipCommit,
  skipPush,
  pathToDocument,
  targetBranch,
  preReleaseId,
  commitMessageToUse, 
  type,
  releaseCommitMessageRegex) => {
  const token = process.env.GITHUB_TOKEN;
  // eslint-disable-next-line security/detect-non-literal-require
  const gitEvents = process.env.GITHUB_EVENT_PATH ? require(process.env.GITHUB_EVENT_PATH) : {};
  logInfo(`Found the following git events: ${JSON.stringify(gitEvents, null, 4)}`);
  const workspace = process.env.GITHUB_WORKSPACE;
  await setGitConfigs();
  pathToDocument = path.join(workspace, pathToDocument);
  logInfo(`Path to document: ${pathToDocument}`);
  const projectFile = getProjectContent(pathToDocument);
  let currentVersion;
  if (type === 'csproj') {
    currentVersion = getCurrentVersionCsproj(projectFile);
  } else if (type === 'assembly') {
    currentVersion = getCurrentVersionAssembly(projectFile);
  }
  logInfo(`Current version: ${currentVersion}`);
  
  const commitMessages = await getCommitMessages(gitEvents, token);
  logInfo(`Found commit messages: ${JSON.stringify(commitMessages, null, 4)}`);

  const relevantCommitMessages = getRelevantCommitMessages(commitMessages, releaseCommitMessageRegex, tagPrefix);
  logInfo(`Relevant commit messages: ${JSON.stringify(relevantCommitMessages, null, 4)}`);
  if (relevantCommitMessages.length === 0) {
    exitSuccess('No action necessary because latest commit was a bump!');
    return false;
  }

  const {doMajorVersion, doMinorVersion, doPatchVersion, doPreReleaseVersion} = analyseVersionChange(majorWording, minorWording, patchWording, rcWording, commitMessages);

  //Should we do any version updates? 
  if (!doMajorVersion && !doMinorVersion && !doPatchVersion && !doPreReleaseVersion) {
    logInfo('Could not find any version bump to make, skipping.');
    return false;
  }
  
  // case: if prerelease id not explicitly set, use the found prerelease id in commit messages
  if (doPreReleaseVersion && !preReleaseId) {
    preReleaseId = findPreReleaseId(rcWording, commitMessages);
  }

  // eslint-disable-next-line security/detect-child-process
  let currentBranch = (/refs\/[a-zA-Z]+\/(.*)/).exec(process.env.GITHUB_REF)[1];
  if (process.env.GITHUB_HEAD_REF) {
    // Comes from a pull request
    currentBranch = process.env.GITHUB_HEAD_REF;
  }
  if (targetBranch !== '') {
    // We want to override the branch that we are pulling / pushing to
    currentBranch = targetBranch;
  }
  logInfo(`Current branch: ${currentBranch}`);

  //Bump version
  const newVersion = bumpVersion(currentVersion, doMajorVersion, doMinorVersion, doPatchVersion, doPreReleaseVersion, preReleaseId);
  let newContent;  
  if (type === 'csproj') {
    newContent = getNewProjectContentCsproj(newVersion, projectFile);
  } else if (type === 'assembly') {
    currentVersion = getCurrentVersionAssembly(projectFile);
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await promises.writeFile(pathToDocument, newContent);
  await commitChanges(newVersion, skipCommit, skipTag, skipPush, commitMessageToUse);
  return true;
};
