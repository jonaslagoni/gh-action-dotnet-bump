// eslint-disable-next-line security/detect-child-process
const { spawn } = require('child_process');
const { readFileSync } = require('fs');
const { EOL } = require('os');
const semverInc = require('semver/functions/inc');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

function logInfo(message) {
  console.info(message);
}
function exitSuccess(message) {
  logInfo(`✔  success   ${message}`);
  process.exit(0);
}

function exitFailure(message) {
  logError(message);
  process.exit(1);
}

function logError(error) {
  console.error(`✖  fatal     ${error.stack || error}`);
}

function getProjectContent(pathToDocument) {
  return readFileSync(pathToDocument);
}
function getCurrentVersionCsproj(csprojDocument) {
  const doc = new DOMParser().parseFromString(
    csprojDocument,
    'text/xml'
  );
  const rootNode = doc.documentElement;
  if (rootNode.hasChildNodes()) {
    const propertyGroupNodes = Object.values(rootNode.childNodes).filter((node) => {
      return node.nodeName === 'PropertyGroup';
    });
    if (propertyGroupNodes.length === 1) {
      const propertyGroupNode = propertyGroupNodes[0];
      
      const versionNodes = Object.values(propertyGroupNode.childNodes).filter((node) => {
        return node.nodeName === 'Version';
      });
      if (versionNodes.length === 1) {
        const versionNode = versionNodes[0];
        versionNode.childNodes.item(0);
        return versionNode.childNodes.item(0).nodeValue;
      }
    }
  }
  return undefined;
}

function getNewProjectContentCsproj(newVersion, csprojDocument) {
  const doc = new DOMParser().parseFromString(
    csprojDocument,
    'text/xml'
  );
  const rootNode = doc.documentElement;
  if (rootNode.hasChildNodes()) {
    const propertyGroupNodes = Object.values(rootNode.childNodes).filter((node) => {
      return node.nodeName === 'PropertyGroup';
    });
    if (propertyGroupNodes.length === 1) {
      const propertyGroupNode = propertyGroupNodes[0];
      const versionNodes = Object.values(propertyGroupNode.childNodes).filter((node) => {
        return node.nodeName === 'Version';
      });
      if (versionNodes.length === 1) {
        const versionNode = versionNodes[0];
        versionNode.childNodes.item(0).data = newVersion;
      } else {
        const versionNode = new DOMParser().parseFromString(
          `<Version>${newVersion}</Version>`,
          'text/xml'
        );
        propertyGroupNode.appendChild(versionNode);
      }
    }
  }
  return new XMLSerializer().serializeToString(rootNode);
}

//Lets make sure we can match everything with exec
RegExp.prototype.execAllGen = function*(input) {
  // eslint-disable-next-line security/detect-child-process
  for (let match; (match = this.exec(input)) !== null;) 
    yield match;
}; RegExp.prototype.execAll = function(input) {
  return [...this.execAllGen(input)];
};
function getCurrentVersionAssembly(assemblyDocument) {
  // eslint-disable-next-line security/detect-unsafe-regex
  const matchAssemblyVersion = /\[assembly: AssemblyVersion\(\"(?<version>.*)\"\)\]/gm;
  const matches = matchAssemblyVersion.execAll(assemblyDocument);
  if (matches.length > 0) {
    // If multiple matches found, lets just assume last match is the value we are looking for...
    const assemblyVersion = matches[matches.length-1].groups.version;
    // Because assembly version matches major.minor.build.patch we need to convert to semver (remove build)
    const versionSplit = assemblyVersion.split('.');
    return `${versionSplit[0]}.${versionSplit[1]}.${versionSplit[3]}`;
  }
  return undefined;
}

function getNewProjectContentAssembly(newSemverVersion, assemblyDocument) {
  // eslint-disable-next-line security/detect-unsafe-regex
  const matchAssemblyVersion = /\[assembly: AssemblyVersion\(\"(?<version>.*)\"\)\]/gm;
  const matches = matchAssemblyVersion.execAll(assemblyDocument);
  const semverSplit = newSemverVersion.split('.');
  const newAssemblyVersion = `${semverSplit[0]}.${semverSplit[1]}.0.${semverSplit.slice(2)}`;
  if (matches.length > 0) {
    //Remove and add version info, as it is easier.
    assemblyDocument = assemblyDocument.replace(matchAssemblyVersion, '');
  } 
  return `${assemblyDocument}
[assembly: AssemblyVersion("${newAssemblyVersion}")]
`;
}

function runInWorkspace(command, args) {
  const workspace = process.env.GITHUB_WORKSPACE;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: workspace });
    let isDone = false;
    const errorMessages = [];
    child.on('error', (error) => {
      if (!isDone) {
        isDone = true;
        reject(error);
      }
    });
    child.stderr.on('data', (chunk) => errorMessages.push(chunk));
    child.on('exit', (code) => {
      if (!isDone) {
        if (code === 0) {
          resolve();
        } else {
          reject(`${errorMessages.join('')}${EOL}${command} exited with code ${code}`);
        }
      }
    });
  });
}

/**
 * Bump the version and return the new version to use.
 * @param {*} currentVersion raw version number 'x.x.x'
 * @param {*} bumpMajorVersion 
 * @param {*} bumpMinorVersion 
 * @param {*} bumpPatchVersion 
 * @returns new version
 */
function bumpVersion(currentVersion, bumpMajorVersion, bumpMinorVersion, bumpPatchVersion, bumpPreReleaseVersion, preReleaseId) {
  let release;
  if (bumpPreReleaseVersion) {
    release = 'prerelease';
  } else if (bumpMajorVersion) {
    release = 'major';
  } else if (bumpMinorVersion) {
    release = 'minor';
  } else if (bumpPatchVersion) {
    release = 'patch';
  }
  return semverInc(currentVersion, release, {}, preReleaseId);
}

function getRelatedGitCommits(gitEvents) {
  const commitMessages = gitEvents.commits;
  if (commitMessages) {  
    if (commitMessages.length === 0) {
      exitFailure('After filtering commits, none matched the AsyncAPI document or referenced files');
    }
    return commitMessages;
  } 
  exitFailure('Could not find any commits, existing');
}

/**
 * Figure out which version change to do.
 */
function analyseVersionChange(majorWording, minorWording, patchWording, rcWording, commitMessages) {
  // input wordings for MAJOR, MINOR, PATCH, PRE-RELEASE
  const majorWords = majorWording.split(',');
  const minorWords = minorWording.split(',');
  // patch is by default empty, and '' would always be true in the includes(''), thats why we handle it separately
  const patchWords = patchWording ? patchWording.split(',') : null;
  const preReleaseWords = rcWording ? rcWording.split(',') : null;
  logInfo(`config words: ${JSON.stringify({ majorWords, minorWords, patchWords, preReleaseWords })}`);

  let doMajorVersion = false;
  let doMinorVersion = false;
  let doPatchVersion = false;
  let doPreReleaseVersion = false;
  // case: if wording for MAJOR found
  if (
    commitMessages.some(
      // eslint-disable-next-line security/detect-unsafe-regex
      (message) => (/^([a-zA-Z]+)(\(.+\))?(\!)\:/).test(message) || majorWords.some((word) => message.includes(word)),
    )
  ) {
    doMajorVersion = true;
  } else if (commitMessages.some((message) => minorWords.some((word) => message.includes(word)))) {
    // case: if wording for MINOR found
    doMinorVersion = true;
  } else if (patchWords && 
    commitMessages.some((message) => patchWords.some((word) => message.includes(word)))) {
    // case: if wording for PATCH found
    doPatchVersion = true;
  } else if (
    preReleaseWords &&
    commitMessages.some((message) => preReleaseWords.some((word) => message.includes(word)))) {
    // case: if wording for PRE-RELEASE found
    doPreReleaseVersion = true;
  }
  return {doMajorVersion, doMinorVersion, doPatchVersion, doPreReleaseVersion};
}

function findPreReleaseId(preReleaseWords, commitMessages) {
  let foundWord = undefined;
  for (const commitMessage of commitMessages) {
    for (const preReleaseWord of preReleaseWords) {
      if (commitMessage.includes(preReleaseWord)) {
        foundWord = preReleaseWord.split('-')[1];
      }
    }
  }
  return foundWord;
}

async function setGitConfigs() {
  // set git user
  await runInWorkspace('git', ['config', 'user.name', `"${process.env.GITHUB_USER || 'Automated Version Bump'}"`]);
  await runInWorkspace('git', [
    'config',
    'user.email',
    `"${process.env.GITHUB_EMAIL || 'gh-action-asyncapi-bump-version@users.noreply.github.com'}"`,
  ]);

  await runInWorkspace('git', ['fetch']);
}

async function commitChanges(newVersion, skipCommit, skipTag, skipPush, commitMessageToUse) {
  try {
    // to support "actions/checkout@v1"
    if (!skipCommit) {
      await runInWorkspace('git', ['commit', '-a', '-m', commitMessageToUse.replace(/{{version}}/g, newVersion)]);
    }
  } catch (e) {
    console.warn(
      'git commit failed because you are using "actions/checkout@v2"; ' +
      'but that does not matter because you dont need that git commit, thats only for "actions/checkout@v1"',
    );
  }

  const remoteRepo = `https://${process.env.GITHUB_ACTOR}:${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git`;
  if (!skipTag) {
    await runInWorkspace('git', ['tag', newVersion]);
    if (!skipPush) {
      await runInWorkspace('git', ['push', remoteRepo, '--follow-tags']);
      await runInWorkspace('git', ['push', remoteRepo, '--tags']);
    }
  } else if (!skipPush) {
    await runInWorkspace('git', ['push', remoteRepo]);
  }
}

module.exports = {
  getProjectContent,
  logInfo,
  exitSuccess, 
  exitFailure,
  logError,
  runInWorkspace,
  bumpVersion,
  getRelatedGitCommits,
  analyseVersionChange,
  findPreReleaseId,
  setGitConfigs,
  commitChanges,
  getCurrentVersionCsproj,
  getNewProjectContentCsproj,
  getCurrentVersionAssembly,
  getNewProjectContentAssembly
};