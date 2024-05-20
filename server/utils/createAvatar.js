const pallete = [
  "#952323",
  "#FFBB5C",
  "#0E21A0",
  "#FF9B50",
  "#94A684",
  "#79155B",
  "#435334",
  "#016A70",
  "#A73121",
  "#352F44",
  "#322653",
  "#068DA9",
  "#F79327",
  "#1B9C85",
  "#C07F00",
  "#9E6F21",
  "#5F264A",
  "#41644A",
  "#245953",
  "#408E91",
  "#7149C6",
  "#A84448",
  "#3A1078",
  "#20262E",
  "#698269",
  "#1F8A70",
  "#0081B4",
];
module.exports = function createAvatar(name) {
  return require("avatar-initials-generator")
    .generate(name, {
      width: 500,
      palette: pallete,
      maxLetters: 2,
      fontProportion: 0.6,
    })
    .toString("base64");
};
