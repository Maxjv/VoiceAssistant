const fs = require('fs');
const file = 'c:/TFTE/TFTE Next Steps MainApp 2.html';
let content = fs.readFileSync(file, 'utf8');

const badBlock = `          block.style.display = 'none';\n        }\n        grid.className = 'fields-grid';`;

const goodBlock = `          block.style.display = 'none';
        }
      });

      const allSubApps = document.querySelectorAll('.subapp-card');
      allSubApps.forEach(subApp => {
        const visibleBlocks = Array.from(subApp.querySelectorAll('.field-block')).filter(block => block.style.display !== 'none');
        if (visibleBlocks.length > 0) {
          subApp.style.display = 'block';
        } else {
          subApp.style.display = 'none';
        }
      });
    }

    document.querySelectorAll('#globalFilters input[type="checkbox"]').forEach(cb => {
      const savedState = localStorage.getItem('tfte_filter_' + cb.value);
      if (savedState !== null) {
        cb.checked = savedState === 'true';
      }
      cb.addEventListener('change', () => {
        localStorage.setItem('tfte_filter_' + cb.value, cb.checked);
        applyGlobalFilter();
      });
    });

    function render() {
      mainContainer.innerHTML = '';
      data.forEach((row, rowIdx) => {
        const card = document.createElement('div');
        card.className = 'subapp-card';

        const header = document.createElement('div');
        header.className = 'subapp-header';
        header.textContent = row.subApp;
        card.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'fields-grid';`;

if (content.indexOf(badBlock) !== -1) {
    content = content.replace(badBlock, goodBlock);
    fs.writeFileSync(file, content);
    console.log("Fix applied!");
} else {
    console.log("Bad block not found, trying with \\r\\n...");
    const badBlock2 = `          block.style.display = 'none';\r\n        }\r\n        grid.className = 'fields-grid';`;
    if (content.indexOf(badBlock2) !== -1) {
        content = content.replace(badBlock2, goodBlock);
        fs.writeFileSync(file, content);
        console.log("Fix applied (windows newlines)!");
    } else {
        console.log("Still not found!");
    }
}
