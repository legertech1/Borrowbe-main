module.exports = (arr) => {
  if (!arr || !arr.length || !arr[0]) return;
  const val = {};
  arr.forEach((obj) => {
    obj = { ...obj, types: obj.types.filter((t) => t != "political") };
    val[obj.types[0]] = {
      short_name: obj.short_name,
      long_name: obj.long_name,
    };
  });

  return val;
};
