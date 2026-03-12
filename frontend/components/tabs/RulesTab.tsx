import type { Category, ClassificationRule, UncategorizedStore } from "@/types/models";
import type { RuleDraft, RuleSortKey } from "@/types/ui";

type Props = {
  rules: ClassificationRule[];
  sortedRules: ClassificationRule[];
  ruleDrafts: Record<number, RuleDraft>;
  categories: Category[];
  uncategorizedStores: UncategorizedStore[];
  uncQuickCategory: Record<string, number>;
  ruleFilterText: string;
  ruleFilterSourceType: string;
  ruleFilterActive: boolean;
  newSourceType: string;
  newProviderName: string;
  newDirection: string;
  newTransactionType: string;
  newMatchText: string;
  newCategoryId: number;
  newPriority: number;
  newActive: boolean;
  uncStore: string;
  ruleSortMark: (key: RuleSortKey) => string;
  onToggleRuleSort: (key: RuleSortKey) => void;
  onChangeRuleFilterText: (value: string) => void;
  onChangeRuleFilterSourceType: (value: string) => void;
  onChangeRuleFilterActive: (value: boolean) => void;
  onSearchRules: () => void;
  onClearRules: () => void;
  onChangeRuleDraft: (id: number, patch: Partial<RuleDraft>) => void;
  onSaveRule: (id: number) => void;
  onDeleteRule: (id: number) => void;
  onChangeNewSourceType: (value: string) => void;
  onChangeNewProviderName: (value: string) => void;
  onChangeNewDirection: (value: string) => void;
  onChangeNewTransactionType: (value: string) => void;
  onChangeNewMatchText: (value: string) => void;
  onChangeNewCategoryId: (value: number) => void;
  onChangeNewPriority: (value: number) => void;
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
        <input value={props.ruleFilterSourceType} onChange={(e) => props.onChangeRuleFilterSourceType(e.target.value)} placeholder="sourceType検索" />
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

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => props.onToggleRuleSort("id")}>
                ID{props.ruleSortMark("id")}
              </th>
              <th className="sortable" onClick={() => props.onToggleRuleSort("sourceType")}>
                条件{props.ruleSortMark("sourceType")}
              </th>
              <th className="sortable" onClick={() => props.onToggleRuleSort("matchText")}>
                matchText{props.ruleSortMark("matchText")}
              </th>
              <th className="sortable" onClick={() => props.onToggleRuleSort("category")}>
                カテゴリ{props.ruleSortMark("category")}
              </th>
              <th>集計</th>
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
                    <div className="stack">
                      <input value={draft.sourceType} onChange={(e) => props.onChangeRuleDraft(rule.id, { sourceType: e.target.value })} placeholder="sourceType" />
                      <input value={draft.providerName} onChange={(e) => props.onChangeRuleDraft(rule.id, { providerName: e.target.value })} placeholder="providerName" />
                      <input value={draft.direction} onChange={(e) => props.onChangeRuleDraft(rule.id, { direction: e.target.value })} placeholder="direction" />
                      <input
                        value={draft.transactionType}
                        onChange={(e) => props.onChangeRuleDraft(rule.id, { transactionType: e.target.value })}
                        placeholder="transactionType"
                      />
                    </div>
                  </td>
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
                      type="number"
                      value={draft.priority}
                      onChange={(e) => props.onChangeRuleDraft(rule.id, { priority: Number(e.target.value) || 100 })}
                      min={1}
                      style={{ width: 88 }}
                    />
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(e) => props.onChangeRuleDraft(rule.id, { isActive: e.target.checked })}
                    />
                  </td>
                  <td>
                    <button onClick={() => props.onSaveRule(rule.id)}>保存</button>
                    <button className="danger-button" onClick={() => props.onDeleteRule(rule.id)}>
                      削除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="section-head">
        <h3>新規ルール追加</h3>
      </div>
      <div className="controls">
        <input value={props.newSourceType} onChange={(e) => props.onChangeNewSourceType(e.target.value)} placeholder="sourceType" />
        <input value={props.newProviderName} onChange={(e) => props.onChangeNewProviderName(e.target.value)} placeholder="providerName" />
        <input value={props.newDirection} onChange={(e) => props.onChangeNewDirection(e.target.value)} placeholder="direction" />
        <input value={props.newTransactionType} onChange={(e) => props.onChangeNewTransactionType(e.target.value)} placeholder="transactionType" />
        <input value={props.newMatchText} onChange={(e) => props.onChangeNewMatchText(e.target.value)} placeholder="matchText" />
        <select value={props.newCategoryId} onChange={(e) => props.onChangeNewCategoryId(Number(e.target.value))}>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={props.newPriority}
          onChange={(e) => props.onChangeNewPriority(Number(e.target.value) || 100)}
          min={1}
          placeholder="priority"
        />
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

      <div className="table-wrap">
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
      </div>
    </section>
  );
}
