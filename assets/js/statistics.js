//---------------------------------------------->
//SECTION const
const monthAbbr = {
  0: "Jan",
  1: "Feb",
  2: "Mar",
  3: "Apr",
  4: "May",
  5: "Jun",
  6: "Jul",
  7: "Aug",
  8: "Sep",
  9: "Oct",
  10: "Nov",
  11: "Dec",
};
const dpColor = {};
let data;
let destroy = {
  dw: undefined,
  mw: undefined,
  ws: undefined,
};
//---------------------------------------------->

//---------------------------------------------->
//SECTION basic function
const select = (selection, singleElement = true) =>
  singleElement
    ? document.querySelector(selection)
    : document.querySelectorAll(selection);

const append = (mainElement, ...subElements) =>
  subElements.forEach((subElement) => {
    mainElement.append(subElement);
  });

function newElement(cls, content = "", tag = "div", attr = []) {
  let element = document.createElement(tag);
  if (cls) {
    if (typeof cls === "object")
      cls.forEach((clsElement) => element.classList.add(clsElement));
    else element.classList.add(cls);
  }
  if (content) element.innerText = content;
  attr.forEach((dattr) => element.setAttribute(...dattr));
  return element;
}
const parseDate = (dateString) => dateString.split("-").map(Number).reverse();
const randomNum = (max = 256) => Math.floor(Math.random() * max);
const insert0 = (arr, ele) => [ele, ...arr];
const refresh = () => {
  hostInfo();
  if (destroy.dw != undefined) {
    destroy.dw.destroy();
    destroy.mw.destroy();
    destroy.sw.destroy();
  }
  destroy.dw = periodByGraph(
    "#dayWise",
    "perDay",
    getAllDatesBetween,
    2 * 60 * 60
  );
  destroy.mw = periodByGraph(
    "#monthWise",
    "perMonth",
    getBetweenMonth,
    2 * 60 * 60 * 30
  );
  destroy.sw = siteWiseChart();
};
const getRandomColor = (ds) => {
  if (dpColor[ds] === undefined)
    dpColor[ds] = `rgb(${randomNum()}, ${randomNum()}, ${randomNum()})`;
  return dpColor[ds];
};
const getMinMax = (ds1, ds2, req) => {
  if (ds1 === undefined) return ds2;
  const date1 = parseDate(ds1);
  const date2 = parseDate(ds2);
  return req === -1 ? (date1 < date2 ? ds1 : ds2) : date1 > date2 ? ds1 : ds2;
};
const dateDDMMYYYY = (date) =>
  `${date.getDate()}-${date.getMonth()}-${date.getFullYear()}`;
const getAllDatesBetween = (startDateStr, endDateStr) => {
  let dateList = [];
  let startDate = new Date(...startDateStr.split("-").reverse());
  let endDate = new Date(...endDateStr.split("-").reverse());
  while (startDate <= endDate) {
    dateList.push(dateDDMMYYYY(new Date(startDate)));
    startDate.setDate(startDate.getDate() + 1);
  }
  return dateList;
};
const getBetweenMonth = (st, end) => {
  let [sm, sy] = st.split("-").map(Number);
  let [em, ey] = end.split("-").map(Number);
  let res = [];
  while ([sy, sm] <= [ey, em]) {
    res.push(`${sm}-${sy}`);
    if (sm == 11) {
      sm = 0;
      sy++;
    } else sm++;
  }
  return res;
};
const creatLimits = (type, site) => {
  const choice = ["None", "Ignore", "Time-limit", "block"];
  const selectEle = newElement("form-select", "", "select", [
    ["aria-label", "Default select example"],
  ]);
  choice.forEach((ch) =>
    selectEle.appendChild(newElement("", ch, "option", [["value", ch]]))
  );
  selectEle.value = type;
  selectEle.onchange = (e) => changeLimit(e, site);
  return selectEle;
};
const limitStylePower = (e) =>
  ({
    None: 1,
    "Time-limit": 2,
    Ignore: 3,
    block: 4,
  }[e.getAttribute("limit-type")]);

const changeLimit = (e, site) => {
  let value = e.target.value;
  let limit;
  if (value === "Time-limit") {
    limit = prompt("Set the limit");
    if (isNaN(limit)) return alert("Invalid");
  }
  read(site, (res_data) => {
    data[site] = res_data;
    data[site].limit.type = value;
    if (value === "Time-limit") data[site].limit.score = limit;

    write(site, data[site]);
    refresh();
  });
};
//---------------------------------------------->

//---------------------------------------------->
//SECTION chrome storage functions
const write = (key, value, callback = () => {}) =>
  chrome.storage.local.set({ [key]: value }, callback);
const read = (key, process) =>
  chrome.storage.local.get(key, (value) => process(value[key]));
//---------------------------------------------->

//---------------------------------------------->
//SECTION graph and table function
const threshold = 0.015; // 2%
const periodByGraph = (canva_id, period, getAll, recommendedScreenTime) => {
  let start, end;
  let siteList = new Array();
  let totalTime = 0;

  // Step 1: Identify all sites & get total time
  for (const key in data) {
    if (data[key].limit.type === "Ignore") continue;
    siteList.push(key);

    for (const d_day in data[key][period]) {
      totalTime += data[key][period][d_day] || 0;
      [start, end] = [getMinMax(start, d_day, -1), getMinMax(end, d_day, 1)];
    }
  }

  if (!siteList.length) {
    select(canva_id).style.display = "none";
    return 0;
  }
  select(canva_id).style.display = "block";

  // Step 2: Group small contributors into "Others"
  const majorSites = [];
  const othersData = {};

  siteList.forEach((site) => {
    let siteTime = 0;
    for (const d_day in data[site][period]) {
      siteTime += data[site][period][d_day] || 0;
    }
    if (siteTime / totalTime >= threshold) {
      majorSites.push(site);
    } else {
      for (const d_day in data[site][period]) {
        othersData[d_day] = (othersData[d_day] || 0) + (data[site][period][d_day] || 0);
      }
    }
  });

  if (Object.keys(othersData).length > 0) {
    data["Others"] = { [period]: othersData, all: Object.values(othersData).reduce((a, b) => a + b, 0), limit: { type: "Include" } };
    majorSites.push("Others");
  }

  // Step 3: Prepare datasets
  const linedata = {
    labels: getAll(start, end),
    datasets: majorSites.map((ds) => ({
      label: ds,
      data: [],
      fill: false,
      borderColor: getRandomColor(ds),
    })),
  };

  const sum = {
    label: "all",
    data: linedata.labels.map((e) => 0),
    fill: false,
    borderColor: "rgb(0,0,0)",
  };

  const recommendedScreenTimeLine = {
    label: "Recommended Screen Time",
    data: linedata.labels.map((e) => recommendedScreenTime),
    fill: true,
    borderColor: "rgb(126, 218, 87)",
    backgroundColor: "rgba(75, 192, 192, 0.2)",
    hidden: true,
    borderWidth: 2,
    borderDash: [5, 5],
  };

  // Step 4: Fill data points
  linedata.labels.forEach((ddate, index) => {
    linedata.datasets.forEach((dline) => {
      const temp = data[dline.label][period][ddate];
      const value = temp || 0;
      dline.data.push(value);
      sum.data[index] += value;
    });
  });

  linedata.datasets = [recommendedScreenTimeLine, sum, ...linedata.datasets];

  // Step 5: Create chart
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      yAxes: [
        {
          ticks: {
            callback: function (time) {
              if (time === 0) return "0 sec";
              const hours = Math.floor(time / 3600);
              const minutes = Math.floor((time % 3600) / 60);
              const seconds = time % 60;

              const components = [];
              if (hours > 0) components.push(`${hours} h`);
              if (minutes > 0) components.push(`${minutes} m`);
              if (seconds > 0) components.push(`${seconds} s`);
              return components.join(" ");
            },
          },
        },
      ],
      xAxes: [
        {
          ticks: {
            callback: function (originalDate) {
              let parts = originalDate.split("-").map(Number);
              parts[parts.length - 2] = monthAbbr[parts[parts.length - 2]];
              return parts.join(" ");
            },
          },
        },
      ],
    },
    plugins: {
      zoom: {
        limits: {
          y: { min: 0, max: 100 },
          y2: { min: -5, max: 5 },
        },
      },
    },
  };

  const ctx = select(canva_id).getContext("2d");
  const myLineChart = new Chart(ctx, {
    type: "line",
    data: linedata,
    options: options,
  });

  return myLineChart;
};

const siteWiseChart = () => {
  let allSite = Object.keys(data).filter(
    (ds) => data[ds].limit.type != "Ignore"
  );
  if (allSite.length == 0) return;
  
  allSite.sort((s1, s2) => data[s2].all - data[s1].all);

  let totalTime = allSite.reduce((sum, site) => sum + data[site].all, 0);
  let majorSites = [];
  let otherTime = 0;

  allSite.forEach((site) => {
    let percent = data[site].all / totalTime;
    if (percent >= threshold) {
      majorSites.push(site);
    } else {
      otherTime += data[site].all;
    }
  });

  // Add "Others" category
  if (otherTime > 0) {
    majorSites.push("Others");
    data["Others"] = { all: otherTime };
  }

  let siteWiseData = {
    labels: majorSites,
    datasets: [
      {
        data: majorSites.map((ds) => data[ds].all),
        backgroundColor: majorSites.map((ds) => getRandomColor(ds)),
        borderWidth: 0.1,
      },
    ],
  };

  let canvas = document.querySelector("#siteWise");
  let ctx = canvas.getContext("2d");

  let myPieChart = new Chart(ctx, {
    type: "pie",
    data: siteWiseData,
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: ({ dataset, dataIndex }) => {
              let value = dataset.data[dataIndex];
              return ((value / totalTime) * 100).toFixed(2) + "%";
            },
          },
        },
        legend: {
          position: 'right',
          labels: {
            font: {
              size: 12,
            },
          },
        },
      },
    },
  });

  return myPieChart;
};

const hostInfo = () => {
  const tbody = select("tbody");
  const res = [];
  tbody.innerHTML = "";
  for (const site in data) {
    const tr = newElement([`site-${site}`, data[site].limit.type], "", "tr", [
      ["limit-type", data[site].limit.type],
    ]);
    append(
      tr,
      newElement(`siteindex`, "", "th"),
      newElement(`sitename`, site, "td")
    );
    if (data[site].limit.type != "Time-limit") {
      const limit = newElement(`sitelimit`, "", "td", [["colspan", "2"]]);
      limit.appendChild(creatLimits(data[site].limit.type, site));
      append(tr, limit);
    } else {
      const limit = newElement(`sitelimit`, "", "td");
      limit.appendChild(creatLimits(data[site].limit.type, site));
      let scope = newElement(
        `sitescope`,
        data[site].limit.score + " minute",
        "td"
      );
      append(tr, limit, scope);
    }
    res.push(tr);
  }
  res.sort((e1, e2) => limitStylePower(e1) - limitStylePower(e2));
  res.forEach((ds, index) => {
    ds.firstChild.innerText = index + 1;
  });
  append(tbody, ...res);
};
//---------------------------------------------->

//---------------------------------------------->
//SECTION init
chrome.storage.local.get(null, (response) => {
  data = response;
  refresh();
});
//---------------------------------------------->
