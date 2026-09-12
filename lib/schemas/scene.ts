export type SceneState = {
  reactor_session_id: string;
  location: string;
  subject_pose: string;
  props: string[];
  lighting: string;
  continuity_locks: string[];
  elapsed_world_seconds: number;
};

export const emptyScene = (): SceneState => ({
  reactor_session_id: "",
  location: "",
  subject_pose: "",
  props: [],
  lighting: "",
  continuity_locks: [],
  elapsed_world_seconds: 0,
});
