clear; clc;

T = readtable(fullfile(fileparts(mfilename('fullpath')), '..', 'data', 'mountain_fronts.csv'), 'TextType', 'string');
smf      = T.smf;
vf       = T.vf_median;
province = T.province;
cls      = T.class;

provs   = ["Puna Plateau", "Eastern Cordillera", "Pampean Ranges"];
markers = {'o', 'o', 'x'};
faces   = {'k', 'w', 'none'};

[rhoAll, pAll] = spearmanRho(smf, vf);
fprintf('All provinces: rho = %.3f, p = %.3g, n = %d\n', rhoAll, pAll, numel(smf));

for k = 1:numel(provs)
    in = province == provs(k);
    [r, p] = spearmanRho(smf(in), vf(in));
    fprintf('%-20s rho = %.3f, p = %.3g, n = %d\n', provs(k), r, p, sum(in));
end

for c = 1:3
    fprintf('Class %d median Vf = %.2f\n', c, median(vf(cls == c)));
end

b = polyfit(smf, log10(vf), 1);
fprintf('Fit: log10(Vf) = %.3f * Smf + %.3f\n', b(1), b(2));

figure('Color', 'w', 'Position', [100 100 820 520]);
hold on; box off;

h = gobjects(1, numel(provs));
for k = 1:numel(provs)
    in = province == provs(k);
    [r, ~] = spearmanRho(smf(in), vf(in));
    h(k) = plot(smf(in), vf(in), markers{k}, ...
        'MarkerEdgeColor', 'k', 'MarkerFaceColor', faces{k}, 'MarkerSize', 6, ...
        'DisplayName', sprintf('%s (\\rho = %.2f)', provs(k), r));
end

xx = linspace(0.9, 4.7, 100);
hFit = plot(xx, 10.^polyval(b, xx), 'k-', 'LineWidth', 2, ...
    'DisplayName', sprintf('Observed fit (\\rho = %.2f, all fronts)', rhoAll));

hExp = plot([1.15 2.6], [0.4 4.5], 'k--', 'LineWidth', 1, ...
    'DisplayName', 'Expected direction');
text(2.65, 4.5, 'expected', 'FontSize', 9);

xline(1.65, ':', 'Class 1 | 2', 'Color', [0.6 0.6 0.6], 'LabelVerticalAlignment', 'bottom');
xline(2.50, ':', 'Class 2 | 3', 'Color', [0.6 0.6 0.6], 'LabelVerticalAlignment', 'bottom');
yline(0.5, '--', 'V-shaped below', 'Color', [0.6 0.6 0.6], 'LabelHorizontalAlignment', 'right');
yline(1.7, '--', 'U-shaped above', 'Color', [0.6 0.6 0.6], 'LabelHorizontalAlignment', 'right');

set(gca, 'YScale', 'log', 'TickDir', 'out', 'FontSize', 10);
xlim([0.6 4.8]);
ylim([0.25 80]);
yticks([0.3 0.5 1 1.7 3 10 30]);
xlabel('Mountain-front sinuosity, S_{mf}');
ylabel('Median valley floor width-to-height ratio, V_f');
title('Valleys versus fronts (189 mountain fronts)');
legend([h hFit hExp], 'Location', 'northeast', 'Box', 'off');

exportgraphics(gcf, fullfile(fileparts(mfilename('fullpath')), '..', 'analysis', 'graph7.png'), 'Resolution', 300);

function [rho, p] = spearmanRho(x, y)
    rx  = avgRank(x(:));
    ry  = avgRank(y(:));
    c   = corrcoef(rx, ry);
    rho = c(1, 2);
    n   = numel(x);
    df  = n - 2;
    t   = rho * sqrt(df / (1 - rho^2));
    p   = betainc(df / (df + t^2), df / 2, 0.5);
end

function r = avgRank(v)
    [s, idx] = sort(v);
    n = numel(v);
    r = zeros(n, 1);
    i = 1;
    while i <= n
        j = i;
        while j < n && s(j + 1) == s(i)
            j = j + 1;
        end
        r(idx(i:j)) = (i + j) / 2;
        i = j + 1;
    end
end
