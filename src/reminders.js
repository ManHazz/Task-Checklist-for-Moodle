import { get, set, getSettings } from './storage.js';
import { isOpen, relative } from './tasks.js';

// For each open task, fire one notification when the clock crosses any unsent
// offset. Several offsets crossed at once (first install, laptop asleep) give
// one notification, not a burst.
export async function checkReminders(now = Date.now()) {
  const tasks = await get('tasks', {});
  const { offsets } = await getSettings();
  const sent = await get('sent', {});

  for (const t of Object.values(tasks)) {
    if (!isOpen(t) || t.due <= now) continue;
    const crossed = offsets.filter((min) => now >= t.due - min * 60000 && !sent[`${t.id}:${min}`]);
    if (!crossed.length) continue;
    for (const min of crossed) sent[`${t.id}:${min}`] = now;
    notify(t, now);
  }

  for (const key of Object.keys(sent)) {
    if (!tasks[key.split(':')[0]]) delete sent[key];
  }
  await set({ sent });
}

function notify(t, now) {
  chrome.notifications.create(`task:${t.id}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `${t.name} — due ${relative(t.due, now)}`,
    message: `${t.course}${t.actionName ? ` · ${t.actionName}` : ''}`,
    contextMessage: new Date(t.due).toLocaleString(),
    priority: 2,
  });
}
