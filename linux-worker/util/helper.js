async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

function getTimestamp() {
  const d = new Date();

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  let hh = d.getHours();
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;

  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');

  return `[${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}.${ms} ${ampm}]`;
};

function logWithTimestamp(...args) {
  console.log(getTimestamp(), ":", ...args);
}


module.exports = {
  delay,
  chunk,
  getTimestamp,
  logWithTimestamp,
};