import $ from 'jquery';
import { appEvents } from 'grafana/app/core/core';

// TODO: function -> class

export default class GraphTooltip {
  ctrl: any;
  panel: any;
  $tooltip: any;

  constructor(private elem, private dashboard, scope, private getSeriesFn) {
    console.log(this.elem)
    this.ctrl = scope.ctrl;
    this.panel = this.ctrl.panel;
    this.$tooltip = $('<div class="graph-tooltip">');

    this.elem.mouseleave(() => {
      if (this.panel.tooltip.shared) {
        var plot = this.elem.data().plot;
        if (plot) {
          this.$tooltip.detach();
          plot.unhighlight();
        }
      }
      appEvents.emit('graph-hover-clear');
    });

    this.elem.bind("plothover", (event, pos, item) => {
      this.show(pos, item);

      // broadcast to other graph panels that we are hovering!
      pos.panelRelY = (pos.pageY - this.elem.offset().top) / this.elem.height();

      console.log('test')
      appEvents.emit('graph-hover', {pos: pos, panel: this.panel});
    });

    this.elem.bind("plotclick", (event, pos, item) => {
      appEvents.emit('graph-click', {pos: pos, panel: this.panel, item: item});
    });
  }

  destroy() {
    this.$tooltip.remove();
  };

  findHoverIndexFromDataPoints(posX, series, last) {
    var ps = series.datapoints.pointsize;
    var initial = last*ps;
    var len = series.datapoints.points.length;
    for (var j = initial; j < len; j += ps) {
      // Special case of a non stepped line, highlight the very last point just before a null point
      if ((!series.lines.steps && series.datapoints.points[initial] != null && series.datapoints.points[j] == null)
          //normal case
          || series.datapoints.points[j] > posX) {
        return Math.max(j - ps,  0)/ps;
      }
    }
    return j/ps - 1;
  };

  findHoverIndexFromData(posX, series) {
    var lower = 0;
    var upper = series.data.length - 1;
    var middle;
    while (true) {
      if (lower > upper) {
        return Math.max(upper, 0);
      }
      middle = Math.floor((lower + upper) / 2);
      if (series.data[middle][0] === posX) {
        return middle;
      } else if (series.data[middle][0] < posX) {
        lower = middle + 1;
      } else {
        upper = middle - 1;
      }
    }
  };

  renderAndShow(absoluteTime, innerHtml, pos, xMode) {
    if (xMode === 'time') {
      innerHtml = '<div class="graph-tooltip-time">'+ absoluteTime + '</div>' + innerHtml;
    }
    (this.$tooltip.html(innerHtml) as any).place_tt(pos.pageX + 20, pos.pageY);
  };

  getMultiSeriesPlotHoverInfo(seriesList, pos) {
    var value, i, series, hoverIndex, hoverDistance, pointTime, yaxis;
    // 3 sub-arrays, 1st for hidden series, 2nd for left yaxis, 3rd for right yaxis.
    var results: any = [[],[],[]];

    //now we know the current X (j) position for X and Y values
    var last_value = 0; //needed for stacked values

    var minDistance, minTime;

    for (i = 0; i < seriesList.length; i++) {
      series = seriesList[i];

      if (!series.data.length || (this.panel.legend.hideEmpty && series.allIsNull)) {
        // Init value so that it does not brake series sorting
        results[0].push({ hidden: true, value: 0 });
        continue;
      }

      if (!series.data.length || (this.panel.legend.hideZero && series.allIsZero)) {
        // Init value so that it does not brake series sorting
        results[0].push({ hidden: true, value: 0 });
        continue;
      }

      hoverIndex = this.findHoverIndexFromData(pos.x, series);
      hoverDistance = pos.x - series.data[hoverIndex][0];
      pointTime = series.data[hoverIndex][0];

      // Take the closest point before the cursor, or if it does not exist, the closest after
      if (! minDistance
          || (hoverDistance >=0 && (hoverDistance < minDistance || minDistance < 0))
          || (hoverDistance < 0 && hoverDistance > minDistance)) {
        minDistance = hoverDistance;
        minTime = pointTime;
      }

      if (series.stack) {
        if (this.panel.tooltip.value_type === 'individual') {
          value = series.data[hoverIndex][1];
        } else if (!series.stack) {
          value = series.data[hoverIndex][1];
        } else {
          last_value += series.data[hoverIndex][1];
          value = last_value;
        }
      } else {
        value = series.data[hoverIndex][1];
      }

      // Highlighting multiple Points depending on the plot type
      if (series.lines.steps || series.stack) {
        // stacked and steppedLine plots can have series with different length.
        // Stacked series can increase its length on each new stacked serie if null points found,
        // to speed the index search we begin always on the last found hoverIndex.
        hoverIndex = this.findHoverIndexFromDataPoints(pos.x, series, hoverIndex);
      }

      // Be sure we have a yaxis so that it does not brake series sorting
      yaxis = 0;
      if (series.yaxis) {
        yaxis = series.yaxis.n;
      }

      results[yaxis].push({
        value: value,
        hoverIndex: hoverIndex,
        color: series.color,
        label: series.aliasEscaped,
        time: pointTime,
        distance: hoverDistance,
        index: i
      });
    }

    // Contat the 3 sub-arrays
    results = results[0].concat(results[1],results[2]);

    // Time of the point closer to pointer
    results.time = minTime;

    return results;
  };

  clear(plot) {
    this.$tooltip.detach();
    plot.clearCrosshair();
    plot.unhighlight();
  };

  show(pos, item?) {
    var plot = this.elem.data().plot;
    var plotData = plot.getData();
    var xAxes = plot.getXAxes();
    var xMode = xAxes[0].options.mode;
    var seriesList = this.getSeriesFn();
    var allSeriesMode = this.panel.tooltip.shared;
    var group, value, absoluteTime, hoverInfo, i, series, seriesHtml, tooltipFormat;

    // if panelRelY is defined another panel wants us to show a tooltip
    // get pageX from position on x axis and pageY from relative position in original panel
    if (pos.panelRelY) {
      var pointOffset = plot.pointOffset({x: pos.x});
      if (Number.isNaN(pointOffset.left) || pointOffset.left < 0 || pointOffset.left > this.elem.width()) {
        this.clear(plot);
        return;
      }
      pos.pageX = this.elem.offset().left + pointOffset.left;
      pos.pageY = this.elem.offset().top + this.elem.height() * pos.panelRelY;
      var isVisible = pos.pageY >= $(window).scrollTop() && pos.pageY <= $(window).innerHeight() + $(window).scrollTop();
      if (!isVisible) {
        this.clear(plot);
        return;
      }
      plot.setCrosshair(pos);
      allSeriesMode = true;

      if (this.dashboard.sharedCrosshairModeOnly()) {
        // if only crosshair mode we are done
        return;
      }
    }

    if (seriesList.length === 0) {
      return;
    }

    if (seriesList[0].hasMsResolution) {
      tooltipFormat = 'YYYY-MM-DD HH:mm:ss.SSS';
    } else {
      tooltipFormat = 'YYYY-MM-DD HH:mm:ss';
    }

    if (allSeriesMode) {
      plot.unhighlight();

      var seriesHoverInfo = this.getMultiSeriesPlotHoverInfo(plotData, pos);

      seriesHtml = '';

      absoluteTime = this.dashboard.formatDate(seriesHoverInfo.time, tooltipFormat);

      // Dynamically reorder the hovercard for the current time point if the
      // option is enabled.
      if (this.panel.tooltip.sort === 2) {
        seriesHoverInfo.sort(function(a, b) {
          return b.value - a.value;
        });
      } else if (this.panel.tooltip.sort === 1) {
        seriesHoverInfo.sort(function(a, b) {
          return a.value - b.value;
        });
      }

      for (i = 0; i < seriesHoverInfo.length; i++) {
        hoverInfo = seriesHoverInfo[i];

        if (hoverInfo.hidden) {
          continue;
        }

        var highlightClass = '';
        if (item && hoverInfo.index === item.seriesIndex) {
          highlightClass = 'graph-tooltip-list-item--highlight';
        }

        series = seriesList[hoverInfo.index];

        value = series.formatValue(hoverInfo.value);

        seriesHtml += '<div class="graph-tooltip-list-item ' + highlightClass + '"><div class="graph-tooltip-series-name">';
        seriesHtml += '<i class="fa fa-minus" style="color:' + hoverInfo.color +';"></i> ' + hoverInfo.label + ':</div>';
        seriesHtml += '<div class="graph-tooltip-value">' + value + '</div></div>';
        plot.highlight(hoverInfo.index, hoverInfo.hoverIndex);
      }

      this.renderAndShow(absoluteTime, seriesHtml, pos, xMode);
    }
    // single series tooltip
    else if (item) {
      series = seriesList[item.seriesIndex];
      group = '<div class="graph-tooltip-list-item"><div class="graph-tooltip-series-name">';
      group += '<i class="fa fa-minus" style="color:' + item.series.color +';"></i> ' + series.aliasEscaped + ':</div>';

      if (this.panel.stack && this.panel.tooltip.value_type === 'individual') {
        value = item.datapoint[1] - item.datapoint[2];
      }
      else {
        value = item.datapoint[1];
      }

      value = series.formatValue(value);

      absoluteTime = this.dashboard.formatDate(item.datapoint[0], tooltipFormat);

      group += '<div class="graph-tooltip-value">' + value + '</div>';

      this.renderAndShow(absoluteTime, group, pos, xMode);
    }
    // no hit
    else {
      this.$tooltip.detach();
    }
  };
}
