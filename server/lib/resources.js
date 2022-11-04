const path = require('path');
const fs = require('fs').promises;
//const { getSubscriptionPage } = require('./api-calls');

// Map of resources and how to handle them.
const RESOURCES = {
  token: {
    path: path.join(process.cwd(), 'server/token.json'),
    protected: true
  },
  credentials: {
    path: path.join(process.cwd(), 'server/credentials.json'),
    protected: true
  },
  subscriptions: {
    path: path.join(process.cwd(), 'server/state/subscriptions.json'),
    //defaultExpire: 3600000,
    protected: false
  },
  playlists: {
    path: path.join(process.cwd(), 'server/state/playlists.json'),
    defaultExpire: 43200000,
    protected: false
  },
  history: {
    path: path.join(process.cwd(), 'server/state/history.json'),
    protected: false
  },
  rules: {
    path: path.join(process.cwd(), 'server/state/rules.json'),
    protected: false
  },
  videos: {
    path: path.join(process.cwd(), 'server/state/videos.json'),
    protected: false
  },
  sortedList: {
    path: path.join(process.cwd(), 'server/state/sortedList.json'),
    protected: false,
    defaultExpire: 3600000
  }
}

/**
 * Reads previously authorized credentials from the save file.
 * Returns JSON.
 *
 * @param {string} resourceName - Lookup to the resource map.
 * @param {bolean} useCache - defaults to true.
 * @param {number | false} - Optional timestamp that bypasses returning cache if it is larger than the lastUpdated value of the cache. Default is false.
 * @param {boolean} loadProtected - Allows cache with "protected" set to true in the map to be loaded. Default is false.
 * @return {<any|false>}
 */
const loadResource = async (resourceName, useCache = true, expireTime = false, loadProtected = false) => {
  const resource = RESOURCES[resourceName];

  // Check if cache is being bypassed
  if (!useCache) {
    console.log(`  Bypassing ${resourceName} cache.`)
    return false;
  }

  // Validate known resource
  if (!resource)
    throw `No definition for resource: ${resourceName}`;

  // Validate protected resources can be loaded
  if (resource.protected && !loadProtected)
    throw `The resource "${resourceName}" is protected, but the "loadProtected" parameter was not supplied, or is set to false.`;

  // Load and return the resource
  try {
    const content = await fs.readFile(resource.path);
    const data = JSON.parse(content);
    const exp = expireTime ? expireTime : resource.defaultExpire || false;

    // No expire time defaulted or passed || diff between last update and now is less than expire time.
    if (!exp || ( exp && ( ( Date.now() - data.lastUpdated ) < exp ) ) ) {
      console.log(`  Retrieved ${resourceName} from cache.`);
      return data;
    } else {
      console.log(`  Cache for ${resourceName} is expired.`);

      //if (resourceName === 'subscriptions') {
      //    return await recacheSubscriptions();
      //}
      return false;
    }
  } catch (err) {
    console.log(`  Error opening file: ${resource.path}`);
    console.log(err);
    return false;
  }
};
/*
const recacheSubscriptions = async() => {
    const subItems = await getSubscriptionPage().then(items => items.map(i => ({
        channelId: i.snippet.resourceId.channelId,
        title: i.snippet.title,
        description: i.snippet.description,
        thumbnail: i.snippet.thumbnails.medium?.url || i.snippet.thumbnails.default?.url,
        newItemCount: i.contentDetails.newItemCount
    })));
    const subscriptionList = { lastUpdated: Date.now(), items: subItems };
    await cacheResource('subscriptions', subscriptionList);
    return subscriptionList;
};
*/

/**
 * Caches a resource file.
 * Returns boolean for success/fail.
 *
 * @param {string} resourceName - Lookup to the resource map.
 * @param {any} data - JSON data to write to the cache.
 * @param {boolean} addTimestamp - Defaults to true.
 * @param {boolean} loadProtected - Allows cache with "protected" set to true in the map to be written. Default is false.
 * @return {<any|false>}
 */
const cacheResource = async(resourceName, data, addTimestamp = true, loadProtected = false) => {
  const resource = RESOURCES[resourceName];
  console.log(`  Caching ${resourceName}`);

  // Validate known resource
  if (!resource)
    throw `No definition for resource: ${resourceName}`;

  // Validate data is supplied
  if (!data)
    throw `No data to cache. Data variable is empty.`;

  // Validate protected resources can be loaded
  if (resource.protected && !loadProtected)
    throw `The resource "${resourceName}" is protected, but the "loadProtected" parameter was not supplied, or is set to false.`;

  try {
    if (addTimestamp) {
      data.lastUpdated = Date.now();
    }
    return await fs.writeFile(resource.path, JSON.stringify(data));
    return true;
  } catch (err) {
    console.log(`  Error writing file: ${resource.path}`);
    console.log(err);
    return false;
  }
};

/**
 * Empties the history.unsorted array.
 *
 * @return {<true>}
 */
const purgeUnsorted = async() => {
  console.log('  Purging unsorted items.')
  let history = await loadResource('history');
  history.unsorted = [];
  await cacheResource('history', history);
  return true;
};

/**
 * Deletes the item with matching ID from the history.unsorted array.
 *
 */
const deleteUnsortedItem = async(id) => {
  console.log(`  Deleting unsorted item: ${id}`);
  let history = await loadResource('history');
  history.unsorted = history.unsorted.filter(u => u.id !== id);
  return await cacheResource('history', history);
};

/**
 * Empties the history.errorQueue array.
 *
 */
const purgeErrors = async() => {
  console.log('  Purging the error queue.');
  let history = await loadResource('history');
  history.errorQueue = [];
  await cacheResource('history', history);
};

/**
 * Deletes the item with matching ID from the history.unsorted array.
 *
 */
const deleteErrorItem = async(id) => {
  console.log(`  Deleting error item: ${id}`);
  let history = await loadResource('history');
  history.errorQueue = history.errorQueue.filter(e => e.video?.id !== id);
  return await cacheResource('history', history);
};

/**
 * Deletes a rule by the specified ID.
 *
 * @param {id} string - Rule ID to delete.
 * @return {<true>}
 */
const deleteRule = async(id) => {
  console.log(`  Deleting rule: ${id}`);
  let rules = await loadResource('rules');
  let ix = await rules.rules.findIndex(r => r.id == id);
  if (ix >= 0) {
    rules.rules.splice(ix, 1);
    await cacheResource('rules', rules);
    return true;
  } else {
    return false;
  }
}

/**
 * Updates the given rule.
 *
 * @param {rule} Rule - Updated rule object.
 * @return {<boolean>}
 */
const updateRule = async(rule) => {
  console.log(`  Updating rule: ${rule.id}`);
  let rules = await loadResource('rules');
  let ix =await  rules.rules.findIndex(r => r.id === rule.id);
  if (ix >= 0) {
    rules.rules[ix] = rule;
    await cacheResource('rules', rules);
    return true;
  } else {
    return false;
  }
}

/**
 * Adds the given rule.
 *
 * @param {rule} Rule - Rule object.
 * @return {<boolean>}
 */
const addRule = async(rule) => {
  console.log(`  Adding rule: ${rule.id}`);
  let rules = await loadResource('rules');
  rules.rules.push(rule);
  await cacheResource('rules', rules);
  return true;
}





const cacheCred = async(user, data) => {
  console.log(`  Caching credentials for user: ${user}`);
  const cachePath = path.join(process.cwd(), `server/credentials-${user}.json`);
  try {
    return await fs.writeFile(cachePath, JSON.stringify(data));
  } catch (err) {
    console.log(`  Error writing file: ${cachePath}`);
    console.log(err);
    return false;
  }
};


module.exports = { loadResource, cacheResource, purgeUnsorted, deleteUnsortedItem, updateRule, deleteRule, addRule, purgeErrors, deleteErrorItem, cacheCred };
