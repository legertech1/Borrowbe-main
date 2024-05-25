const juice = require("juice");

const header = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Montserrat:wght@300;400;500;600;700;800;900&display=swap");
      @import url("https://fonts.googleapis.com/css2?family=Wix+Madefor+Text:ital,wght@0,400..800;1,400..800&display=swap");

      :root {
        --font1: Montserrat, Sans-serif;
        --font2: "Wix Madefor Text", sans-serif;
      }
      body {
       
       
        font-family: var(--font2);
      
      }
      h1 {
        font-weight: 500;
        text-align: center;
        font-family: var(--font1);
        margin: 20px 0;
        font-size:32px
      }
      a {
        text-decoration: none;
        color: #2196f3 !important;
        font-size:1.2rem;
      }
      p {
        text-align: left;
        margin: 12px 0;
        font-size:1rem;

      }
      p.light {
        color: #555;
      }
      p.code {
        font-size: 1.8rem;
        font-weight: 500;
        font-family: var(--font1);
        letter-spacing: 5px;
        color: #2196f3;
      }
      h3, h4 {
        font-family: var(--font2);
        font-weight: 600;
        text-align: left;
        margin:16px 0;
      }
      h3 {
        font-size: 1.2rem;
      }
      h4 {
        font-size: 1rem;
      }
    </style>
  </head>
  <body>
  <div class="body" style="
  height: 100%;
  margin: auto;
  width: 100%;
  box-sizing:border-box;
  margin:auto;
  font-family: var(--font2);
  background:#2196f322;
  padding: 100px 0">
   
  <div class="main" style="
    padding: 4%;
    max-width: 800px;
    width:100%;
    box-sizing: border-box;
    background:white;
    margin:auto;
  ">
  <div class="logo" style="margin:auto;">
  <img style="width:100%;
  max-width: 300px;
  margin: auto;
  display: block;" 
  src="https://borrowbe-dev.s3.ca-central-1.amazonaws.com/logo.jpg" alt="Borrowbe LOGO"/>
  </div>
`;

const footer = `
    </div>
    <div class="footer" style="
    align-items: start;
    background: #eee;
    padding: 20px 4%;
    max-width: 800px;
    width:100%;
    background:#333;
    box-sizing: border-box;
    margin:auto;
    color:white;
    
  ">
      BorrowBe Inc. | 1688 Melrose Pl SW Edmonton Alberta T6W 1X6 Canada
    </div>
    </div>
  </body>
</html>
`;

module.exports = function ({ content, heading }) {
  const fullHtml = `${header}
  <h1>${heading}</h1>
  ${content}
  ${footer}`;

  // Use juice to inline the CSS
  const inlinedHtml = juice(fullHtml);

  return inlinedHtml;
};
