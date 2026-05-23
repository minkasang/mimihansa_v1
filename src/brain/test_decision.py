"""
测试大脑决策系统
"""
import json
import sys
from pathlib import Path

# 添加src到路径
sys.path.insert(0, str(Path(__file__).parent))

from decision_engine import BrainDecisionEngine


def test_npc_decision(npc_name: str, engine: BrainDecisionEngine):
    """测试单个NPC的决策"""
    print(f"\n{'='*50}")
    print(f"测试NPC: {npc_name}")
    print('='*50)

    # 加载NPC数据
    npc_path = f"../../NPC/{npc_name}/个人信息.json"
    with open(npc_path, 'r', encoding='utf-8') as f:
        npc_data = json.load(f)

    # 显示性格
    print(f"\n性格:")
    personality = npc_data.get("性格", {})
    key_traits = ["乐观", "社交欲", "勇敢", "大方", "谨慎"]
    for trait in key_traits:
        print(f"  {trait}: {personality.get(trait, 5)}")

    # 获取可用动作
    available = engine.get_available_actions(npc_data)
    print(f"\n可用动作: {available}")

    # 测试每个动作
    print(f"\n动作评估:")
    print("-" * 50)

    current_state = npc_data.get("生理状态", {})
    environment = {
        "可见目标": [{"外貌": 9, "名称": "齐琳琳"}],
        "时间": "2026-06-01 10:00:00"
    }

    results = []
    for action_id in available:
        score = engine.calculate_action_score(
            personality,
            action_id,
            current_state,
            environment.get("可见目标")[0] if environment.get("可见目标") else None
        )
        results.append(score)

        status = "✓" if score.can_execute else "✗"
        print(f"{status} {action_id:20} 得分: {score.final_score:6.1f} | {score.reason}")

    # 找出最佳动作
    valid_results = [r for r in results if r.can_execute]
    if valid_results:
        best = max(valid_results, key=lambda x: x.final_score)
        print(f"\n最佳动作: {best.action_id} (得分: {best.final_score:.1f})")
    else:
        print("\n没有可执行的动作")


def main():
    """主函数"""
    print("大脑决策系统测试")
    print("=" * 50)

    # 初始化引擎
    engine = BrainDecisionEngine("../../data/libraries/Brains_Library.json")

    # 测试云飞（乐观，会追求）
    test_npc_decision("云飞", engine)

    # 测试刘坤（普通，不会追求）
    test_npc_decision("刘坤", engine)

    # 测试齐琳琳（高冷，不会主动）
    test_npc_decision("齐琳琳", engine)

    print("\n" + "=" * 50)
    print("测试完成!")


if __name__ == "__main__":
    main()
