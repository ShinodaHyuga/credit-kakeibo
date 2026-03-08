import type { Category, CategoryRule, UncategorizedStore } from "@/types/models";
import type { RuleDraft, RuleSortKey } from "@/types/ui";

type Props = {
  rules: CategoryRule[];
  sortedRules: CategoryRule[];
  ruleDrafts: Record<number, RuleDraft>;
  categories: Category[];
  uncategorizedStores: UncategorizedStore[];
  uncQuickCategory: Record<string, number>;
  ruleFilterText: string;
  ruleFilterActive: boolean;
  newMatchText: string;
  newCategoryId: number;
  newActive: boolean;
  uncStore: string;
  ruleSortMark: (key: RuleSortKey) => string;
  onToggleRuleSort: (key: RuleSortKey) => void;
  onChangeRuleFilterText: (value: string) => void;
  onChangeRuleFilterActive: (value: boolean) => void;
  onSearchRules: () => void;
  onClearRules: () => void;
  onChangeRuleDraft: (id: number, patch: Partial<RuleDraft>) => void;
  onSaveRule: (id: number) => void;
  onDeleteRule: (id: number) => void;
  onChangeNewMatchText: (value: string) => void;
  onChangeNewCategoryId: (value: number) => void;
  onChangeNewActive: (value: boolean) => void;
  onCreateRule: () => void;
  onChangeUncStore: (value: string) => void;
  onSearchUncategorized: () => void;
  onClearUncategorized: () => void;
  onChangeUncQuickCategory: (storeName: string, categoryId: number) => void;
  onCreateRuleFromUncategorized: (storeName: string) => void;
};

export function RulesTab(props: Props) {
  return (
    <section className="panel active">
      <div className="section-head">
        <h3>判定ルール</h3>
        <span className="badge">{props.rules.length.toLocaleString("ja-JP")} 件</span>
      </div>
      <div className="controls">
        <input value={props.ruleFilterText} onChange={(e) => props.onChangeRuleFilterText(e.target.value)} placeholder="matchText検索" />
        <label>
          <input
            type="checkbox"
            checked={props.ruleFilterActive}
            onChange={(e) => props.onChangeRuleFilterActive(e.target.checked)}
          />
          有効のみ
        </label>
        <button onClick={props.onSearchRules}>検索</button>
        <button className="ghost" onClick={props.onClearRules}>
          クリア
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th className="sortable" onClick={() => props.onToggleRuleSort("id")}>
              ID{props.ruleSortMark("id")}
            </th>
            <th className="sortable" onClick={() => props.onToggleRuleSort("matchText")}>
              matchText{props.ruleSortMark("matchText")}
            </th>
            <th className="sortable" onClick={() => props.onToggleRuleSort("category")}>
              カテゴリ{props.ruleSortMark("category")}
            </th>
            <th>有効</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {props.sortedRules.map((rule) => {
            const draft = props.ruleDrafts[rule.id];
            if (!draft) return null;
            return (
              <tr key={rule.id}>
                <td>{rule.id}</td>
                <td>
                  <input value={draft.matchText} onChange={(e) => props.onChangeRuleDraft(rule.id, { matchText: e.target.value })} />
                </td>
                <td>
                  <select
                    value={draft.categoryId}
                    onChange={(e) => props.onChangeRuleDraft(rule.id, { categoryId: Number(e.target.value) })}
                  >
                    {props.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => props.onChangeRuleDraft(rule.id, { isActive: e.target.checked })}
                  />
                </td>
                <td>
                  <button onClick={() => props.onSaveRule(rule.id)}>保存</button>
                  <button onClick={() => props.onDeleteRule(rule.id)}>削除</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="section-head">
        <h3>新規ルール追加</h3>
      </div>
      <div className="controls">
        <input value={props.newMatchText} onChange={(e) => props.onChangeNewMatchText(e.target.value)} placeholder="matchText" />
        <select value={props.newCategoryId} onChange={(e) => props.onChangeNewCategoryId(Number(e.target.value))}>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={props.newActive} onChange={(e) => props.onChangeNewActive(e.target.checked)} /> 有効
        </label>
        <button onClick={props.onCreateRule}>追加</button>
      </div>

      <div className="section-head">
        <h3>未分類店舗</h3>
        <span className="badge danger">{props.uncategorizedStores.length.toLocaleString("ja-JP")} 件</span>
      </div>
      <div className="controls">
        <input value={props.uncStore} onChange={(e) => props.onChangeUncStore(e.target.value)} placeholder="店舗名検索" />
        <button onClick={props.onSearchUncategorized}>検索</button>
        <button className="ghost" onClick={props.onClearUncategorized}>
          クリア
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>店舗名</th>
            <th>クイック追加</th>
          </tr>
        </thead>
        <tbody>
          {props.uncategorizedStores.map((store) => (
            <tr key={store.storeName}>
              <td className="uncategorized">{store.storeName}</td>
              <td>
                <select
                  value={props.uncQuickCategory[store.storeName] ?? props.categories[0]?.id ?? 0}
                  onChange={(e) => props.onChangeUncQuickCategory(store.storeName, Number(e.target.value))}
                >
                  {props.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => props.onCreateRuleFromUncategorized(store.storeName)}>追加</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
