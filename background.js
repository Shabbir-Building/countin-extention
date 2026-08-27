async function getData() {
  const data = await chrome.storage.local.get([
    "dailyCount",
    "weeklyCount",
    "monthlyCount",
    "dailyResetKey",
    "weeklyResetKey",
    "monthlyResetKey",
    "count",
    "lastResetDate",
  ]);

  const dailyCount = Number(data.dailyCount ?? data.count ?? 0);

  return {
    dailyCount,
    weeklyCount: Number(data.weeklyCount ?? 0),
    monthlyCount: Number(data.monthlyCount ?? 0),
    dailyResetKey: data.dailyResetKey || "",
    weeklyResetKey: data.weeklyResetKey || "",
    monthlyResetKey: data.monthlyResetKey || "",
    count: dailyCount,
    lastResetDate: data.lastResetDate || "",
  };
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getWeeklyResetKey(now) {
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);

  const dayIndex = current.getDay();
  const diffToSaturday = dayIndex === 6 ? 0 : 6 - dayIndex;
  current.setDate(current.getDate() + diffToSaturday);

  return getDateKey(current);
}

function getResetKeys(now = new Date()) {
  return {
    dailyResetKey: getDateKey(now),
    weeklyResetKey: getWeeklyResetKey(now),
    monthlyResetKey: getMonthKey(now),
  };
}

async function checkReset() {
  const data = await getData();
  const now = new Date();
  const resetKeys = getResetKeys(now);
  const updatedState = {
    dailyCount: data.dailyCount,
    weeklyCount: data.weeklyCount,
    monthlyCount: data.monthlyCount,
    dailyResetKey: data.dailyResetKey,
    weeklyResetKey: data.weeklyResetKey,
    monthlyResetKey: data.monthlyResetKey,
  };

  if (data.dailyResetKey !== resetKeys.dailyResetKey) {
    updatedState.dailyCount = 0;
    updatedState.dailyResetKey = resetKeys.dailyResetKey;
  }

  if (data.weeklyResetKey !== resetKeys.weeklyResetKey) {
    updatedState.weeklyCount = 0;
    updatedState.weeklyResetKey = resetKeys.weeklyResetKey;
  }

  if (data.monthlyResetKey !== resetKeys.monthlyResetKey) {
    updatedState.monthlyCount = 0;
    updatedState.monthlyResetKey = resetKeys.monthlyResetKey;
  }

  if (
    updatedState.dailyCount !== data.dailyCount ||
    updatedState.weeklyCount !== data.weeklyCount ||
    updatedState.monthlyCount !== data.monthlyCount ||
    updatedState.dailyResetKey !== data.dailyResetKey ||
    updatedState.weeklyResetKey !== data.weeklyResetKey ||
    updatedState.monthlyResetKey !== data.monthlyResetKey
  ) {
    await chrome.storage.local.set(updatedState);
  }

  return updatedState;
}

chrome.runtime.onInstalled.addListener(async () => {
  await checkReset();
});

chrome.runtime.onStartup.addListener(async () => {
  await checkReset();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "INCREMENT_COMMENT_COUNT") {
    checkReset().then(async () => {
      const data = await getData();
      const newDailyCount = data.dailyCount + 1;
      const newWeeklyCount = data.weeklyCount + 1;
      const newMonthlyCount = data.monthlyCount + 1;

      await chrome.storage.local.set({
        dailyCount: newDailyCount,
        weeklyCount: newWeeklyCount,
        monthlyCount: newMonthlyCount,
        count: newDailyCount,
      });

      sendResponse({
        count: newDailyCount,
        dailyCount: newDailyCount,
        weeklyCount: newWeeklyCount,
        monthlyCount: newMonthlyCount,
      });
    });

    return true;
  }

  if (message.type === "GET_COMMENT_COUNT") {
    checkReset().then(async () => {
      const data = await getData();

      sendResponse({
        count: data.dailyCount,
        dailyCount: data.dailyCount,
        weeklyCount: data.weeklyCount,
        monthlyCount: data.monthlyCount,
      });
    });

    return true;
  }

  return false;
});
