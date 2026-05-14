(function () {
    "use strict";

    var PAGE_SIZE = 30;
    var allArticles = [];
    var filtered = [];
    var shown = 0;
    var activeSource = null;

    var SOURCE_NAMES = {
        pma: "Product Marketing Alliance",
        andrew_chen: "Andrew Chen",
        intercom: "Intercom Blog",
        hubspot: "HubSpot Marketing",
        saastr: "SaaStr",
        lenny: "Lenny's Newsletter",
        growth_unhinged: "Growth Unhinged",
        chartmogul: "ChartMogul"
    };

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function renderCard(article) {
        var card = document.createElement("div");
        card.className = "article-card border-" + article.source;

        var title = document.createElement("div");
        title.className = "article-title";
        var link = document.createElement("a");
        link.href = article.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = article.title;
        title.appendChild(link);

        var meta = document.createElement("div");
        meta.className = "article-meta";

        var tag = document.createElement("span");
        tag.className = "source-tag source-" + article.source;
        tag.textContent = article.source_name || SOURCE_NAMES[article.source] || article.source;

        var date = document.createElement("span");
        date.className = "article-date";
        date.textContent = article.date || "No date";

        meta.appendChild(tag);
        meta.appendChild(date);

        card.appendChild(title);
        card.appendChild(meta);

        if (article.summary) {
            var summary = document.createElement("p");
            summary.className = "article-summary";
            summary.textContent = article.summary;
            card.appendChild(summary);
        }

        return card;
    }

    function renderArticles() {
        var container = $("articles");
        container.innerHTML = "";

        var end = Math.min(shown, filtered.length);
        for (var i = 0; i < end; i++) {
            container.appendChild(renderCard(filtered[i]));
        }

        var loadMoreWrap = $("load-more-wrap");
        if (shown < filtered.length) {
            loadMoreWrap.style.display = "block";
        } else {
            loadMoreWrap.style.display = "none";
        }
    }

    function applyFilter(source) {
        if (source === activeSource) {
            activeSource = null;
        } else {
            activeSource = source;
        }

        // Update pill states
        var pills = document.querySelectorAll(".filter-pill");
        for (var i = 0; i < pills.length; i++) {
            var pill = pills[i];
            if (pill.dataset.source === activeSource) {
                pill.classList.add("active");
            } else {
                pill.classList.remove("active");
            }
        }

        // Filter articles
        if (activeSource) {
            filtered = allArticles.filter(function (a) {
                return a.source === activeSource;
            });
        } else {
            filtered = allArticles.slice();
        }

        shown = PAGE_SIZE;
        renderArticles();
    }

    function buildFilters(sources) {
        var container = $("filters");
        container.innerHTML = "";

        // Collect unique sources from articles
        var seen = {};
        for (var i = 0; i < allArticles.length; i++) {
            var s = allArticles[i].source;
            if (!seen[s]) {
                seen[s] = true;
            }
        }

        // Also include sources from status
        if (sources) {
            for (var key in sources) {
                if (sources.hasOwnProperty(key)) {
                    seen[key] = true;
                }
            }
        }

        var keys = Object.keys(seen).sort();
        for (var j = 0; j < keys.length; j++) {
            var key = keys[j];
            var pill = document.createElement("span");
            pill.className = "filter-pill source-" + key;
            pill.dataset.source = key;
            pill.textContent = SOURCE_NAMES[key] || key;
            pill.addEventListener("click", (function (k) {
                return function () { applyFilter(k); };
            })(key));
            container.appendChild(pill);
        }
    }

    function updateStats(status) {
        if (status && status.total_articles > 0) {
            $("stat-articles").textContent = status.total_articles + " articles";
            var activeCount = 0;
            if (status.sources) {
                for (var k in status.sources) {
                    if (status.sources.hasOwnProperty(k) && status.sources[k].status === "ok") {
                        activeCount++;
                    }
                }
            }
            $("stat-sources").textContent = activeCount + " sources active";
            if (status.last_updated) {
                var d = new Date(status.last_updated);
                $("stat-updated").textContent = "Updated " + d.toLocaleDateString();
            }
        }
    }

    function init() {
        Promise.all([
            fetch("data/articles.json").then(function (r) { return r.json(); }),
            fetch("data/status.json").then(function (r) { return r.json(); })
        ]).then(function (results) {
            allArticles = results[0] || [];
            var status = results[1] || {};

            if (allArticles.length === 0) {
                $("empty-state").style.display = "block";
                return;
            }

            filtered = allArticles.slice();
            shown = PAGE_SIZE;

            updateStats(status);
            buildFilters(status.sources);
            renderArticles();

            $("load-more").addEventListener("click", function () {
                shown += PAGE_SIZE;
                renderArticles();
            });
        }).catch(function (err) {
            console.error("Failed to load data:", err);
            $("empty-state").style.display = "block";
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
