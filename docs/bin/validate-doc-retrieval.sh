#!/usr/bin/env bash

set -euo pipefail

DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$DOCS_DIR/.." && pwd)"
DESIGN_README="$DOCS_DIR/design/README.md"
ACTIVE_DOCS="$DOCS_DIR/_indexes/active-docs.md"
DESIGN_MAP="$DOCS_DIR/_indexes/design-map.md"
CONTEXT_PACKETS="$DOCS_DIR/_indexes/context-packets.yaml"
RETRIEVAL_POLICY="$DOCS_DIR/_indexes/retrieval-policy.yaml"
DESIGN_TEMPLATE="$DOCS_DIR/_templates/design.md"
RETRIEVAL_DESIGN="$DOCS_DIR/architecture/retrieval-plane.md"
HYBRID_GUIDE="$DOCS_DIR/guide/hybrid-retrieval-and-freshness.md"

error_count=0

error() {
  echo "error: $*" >&2
  error_count=$((error_count + 1))
}

require_file() {
  if [[ ! -f "$1" ]]; then
    error "missing required file: $1"
    return 1
  fi
}

require_contains() {
  local path="$1"
  local pattern="$2"

  if ! grep -Fq -- "$pattern" "$path"; then
    error "missing expected text '$pattern' in $path"
  fi
}

require_section() {
  require_contains "$1" "## $2"
}

status_of() {
  local file="$1"

  awk '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }

    NR == 1 && $0 == "---" {
      in_frontmatter = 1
      next
    }

    in_frontmatter && $0 == "---" {
      in_frontmatter = 0
      next
    }

    in_frontmatter && tolower($0) ~ /^status:[[:space:]]*/ {
      value = $0
      sub(/^[^:]*:[[:space:]]*/, "", value)
      print tolower(trim(value))
      found = 1
      exit
    }

    /^- Status:[[:space:]]*/ {
      value = $0
      sub(/^- Status:[[:space:]]*/, "", value)
      print tolower(trim(value))
      found = 1
      exit
    }

    END {
      if (!found) {
        print ""
      }
    }
  ' "$file"
}

has_frontmatter() {
  [[ -f "$1" && "$(sed -n '1p' "$1")" == "---" ]]
}

frontmatter_scalar() {
  local file="$1"
  local key="$2"

  awk -v wanted_key="$key" '
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit }
    in_frontmatter && $0 ~ "^" wanted_key ":[[:space:]]*" {
      value = $0
      sub("^" wanted_key ":[[:space:]]*", "", value)
      print value
      exit
    }
  ' "$file"
}

frontmatter_list_first() {
  local file="$1"
  local key="$2"

  awk -v wanted_key="$key" '
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit }
    in_frontmatter && $0 == wanted_key ":" { in_list = 1; next }
    in_list && /^  - / {
      value = $0
      sub(/^  - /, "", value)
      print value
      exit
    }
    in_list && /^[^[:space:]]/ { exit }
  ' "$file"
}

frontmatter_context_scalar() {
  local file="$1"
  local key="$2"

  awk -v wanted_key="$key" '
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit }
    in_frontmatter && $0 == "context:" { in_context = 1; next }
    in_context && /^[^[:space:]]/ { exit }
    in_context && $0 ~ "^  " wanted_key ":[[:space:]]*" {
      value = $0
      sub("^  " wanted_key ":[[:space:]]*", "", value)
      print value
      exit
    }
  ' "$file"
}

is_active_status() {
  case "$1" in
    active|current) return 0 ;;
    *) return 1 ;;
  esac
}

is_inactive_status() {
  case "$1" in
    done|closed|completed|cancelled|superseded|retired) return 0 ;;
    *) return 1 ;;
  esac
}

is_unlisted_status() {
  case "$1" in
    draft|blocked) return 0 ;;
    *) return 1 ;;
  esac
}

indexed_section() {
  local index="$1"
  local header="$2"

  awk -v header="$header" '
    $0 == header {
      in_section = 1
      next
    }
    in_section && /^## / {
      exit
    }
    in_section {
      print
    }
  ' "$index"
}

validate_active_folder() {
  local folder="$1"
  local glob="$2"
  local readme="$folder/README.md"
  local active_text
  local file
  local relative
  local status

  if [[ ! -f "$readme" ]]; then
    error "missing active README: $readme"
    return
  fi

  active_text="$(indexed_section "$readme" "## Active")"

  shopt -s nullglob
  for file in "$folder"/$glob; do
    [[ "$(basename "$file")" == "README.md" ]] && continue
    base="$(basename "$file")"
    status="$(status_of "$file")"

    if is_active_status "$status"; then
      if ! grep -Fq "$base" <<<"$active_text"; then
        error "active doc missing from README Active section: $file"
      fi
      if ! has_frontmatter "$file"; then
        error "active doc missing YAML frontmatter: $file"
      fi
    elif is_inactive_status "$status"; then
      if grep -Fq "$base" <<<"$active_text"; then
        error "README Active section includes inactive doc ($status): $file"
      fi
    elif ! is_unlisted_status "$status"; then
      error "unsupported or missing status '$status' in $file"
    fi
  done
  shopt -u nullglob
}

validate_active_docs_section() {
  local folder="$1"
  local glob="$2"
  local header="$3"
  local section
  local file
  local base
  local status
  local count
  local active_count=0
  local indexed_count

  if [[ ! -f "$ACTIVE_DOCS" ]]; then
    error "missing active docs index: $ACTIVE_DOCS"
    return
  fi

  section="$(indexed_section "$ACTIVE_DOCS" "$header")"
  if [[ -z "$section" ]]; then
    error "missing or empty active docs section '$header' in $ACTIVE_DOCS"
    return
  fi

  shopt -s nullglob
  for file in "$folder"/$glob; do
    [[ "$(basename "$file")" == "README.md" ]] && continue
    base="$(basename "$file")"
    status="$(status_of "$file")"
    count="$(grep -Fc "$base" <<<"$section" || true)"

    if is_active_status "$status"; then
      active_count=$((active_count + 1))
      if [[ "$count" != "1" ]]; then
        error "active doc must appear exactly once in $header: $base (found $count)"
      fi
    elif is_inactive_status "$status"; then
      if [[ "$count" != "0" ]]; then
        error "inactive doc appears in $header: $base (found $count)"
      fi
    elif ! is_unlisted_status "$status"; then
      error "unsupported or missing status '$status' in $file"
    fi
  done
  shopt -u nullglob

  indexed_count="$(awk '
    /^\|/ {
      if ($0 ~ /_none_/) next
      if ($0 ~ /^\|[[:space:]]*-+[[:space:]]*\|/) next
      if (!seen_header) {
        seen_header = 1
        next
      }
      count++
    }
    END { print count + 0 }
  ' <<<"$section")"

  if [[ "$indexed_count" != "$active_count" ]]; then
    error "$header row count does not match active source docs (index $indexed_count, source $active_count)"
  fi

  if (( active_count > 0 )); then
    if grep -Fq '_none_' <<<"$section"; then
      error "$header must remove the _none_ sentinel when active rows exist"
    fi
  elif [[ "$(grep -Fc '_none_' <<<"$section" || true)" != "1" ]]; then
    error "$header must contain exactly one _none_ sentinel row when no active docs exist"
  fi
}

validate_design_indexes() {
  local file
  local base
  local count
  local line
  local pipes
  local design_count=0
  local readme_count
  local map_count
  local retrieval_class
  local domain
  local size_tier
  local default_load
  local section_load
  local readme_class
  local readme_size
  local map_class
  local map_domain
  local map_size
  local map_default
  local map_section

  require_file "$DESIGN_README" || return
  require_file "$DESIGN_MAP" || return
  require_file "$DESIGN_TEMPLATE" || return

  while IFS= read -r -d '' file; do
    relative="${file#$DOCS_DIR/design/}"
    design_count=$((design_count + 1))

    if ! has_frontmatter "$file"; then
      error "design doc missing YAML frontmatter: $file"
    fi

    for field in 'retrieval_class:' 'context:' 'default_load:' 'section_load:' 'size_tier:'; do
      if ! grep -Fq "$field" "$file"; then
        error "design doc missing retrieval metadata '$field': $file"
      fi
    done

    count="$(grep -F "]($relative)" "$DESIGN_README" | grep -Ec '^\| \[' || true)"
    if [[ "$count" != "1" ]]; then
      error "design doc must appear exactly once in docs/design/README.md: $relative (found $count)"
      continue
    else
      line="$(grep -F "]($relative)" "$DESIGN_README" | grep -E '^\| \[')"
      pipes="$(awk -F'|' '{ print NF - 1 }' <<<"$line")"
      if (( pipes < 8 )); then
        error "design index row is missing required columns: $relative"
      fi
    fi

    count="$(grep -F "docs/design/$relative" "$DESIGN_MAP" | grep -Ec '^\|' || true)"
    if [[ "$count" != "1" ]]; then
      error "design doc must appear exactly once in docs/_indexes/design-map.md: $relative (found $count)"
      continue
    fi

    retrieval_class="$(frontmatter_list_first "$file" retrieval_class)"
    domain="$(frontmatter_scalar "$file" domain)"
    size_tier="$(frontmatter_context_scalar "$file" size_tier)"
    default_load="$(frontmatter_context_scalar "$file" default_load)"
    section_load="$(frontmatter_context_scalar "$file" section_load)"

    line="$(grep -F "]($relative)" "$DESIGN_README" | grep -E '^\| \[')"
    readme_class="$(awk -F'|' '{ value=$4; gsub(/^[[:space:]`]+|[[:space:]`]+$/, "", value); print value }' <<<"$line")"
    readme_size="$(awk -F'|' '{ value=$7; gsub(/^[[:space:]]+|[[:space:]]+$/, "", value); print value }' <<<"$line")"

    line="$(grep -F "docs/design/$relative" "$DESIGN_MAP" | grep -E '^\|')"
    map_class="$(awk -F'|' '{ value=$3; gsub(/^[[:space:]`]+|[[:space:]`]+$/, "", value); print value }' <<<"$line")"
    map_domain="$(awk -F'|' '{ value=$4; gsub(/^[[:space:]`]+|[[:space:]`]+$/, "", value); print value }' <<<"$line")"
    map_size="$(awk -F'|' '{ value=$5; gsub(/^[[:space:]`]+|[[:space:]`]+$/, "", value); print value }' <<<"$line")"
    map_default="$(awk -F'|' '{ value=$6; gsub(/^[[:space:]`]+|[[:space:]`]+$/, "", value); print value }' <<<"$line")"
    map_section="$(awk -F'|' '{ value=$7; gsub(/^[[:space:]`]+|[[:space:]`]+$/, "", value); print value }' <<<"$line")"

    [[ "$readme_class" == "$retrieval_class" ]] || error "design README retrieval class drift for $relative"
    [[ "$readme_size" == "$size_tier" ]] || error "design README size tier drift for $relative"
    [[ "$map_class" == "$retrieval_class" ]] || error "design map retrieval class drift for $relative"
    [[ "$map_domain" == "$domain" ]] || error "design map domain drift for $relative"
    [[ "$map_size" == "$size_tier" ]] || error "design map size tier drift for $relative"
    [[ "$map_default" == "$default_load" ]] || error "design map default_load drift for $relative"
    [[ "$map_section" == "$section_load" ]] || error "design map section_load drift for $relative"
  done < <(find "$DOCS_DIR/design" -type f -name '*.md' ! -name README.md -print0 | sort -z)

  readme_count="$(grep -Ec '^\| \[`[^`]+\.md`\]\(' "$DESIGN_README" || true)"
  map_count="$(grep -Ec '^\| `docs/design/[^`]+\.md`' "$DESIGN_MAP" || true)"
  if [[ "$readme_count" != "$design_count" ]]; then
    error "docs/design/README.md row count does not match design docs (index $readme_count, source $design_count)"
  fi
  if [[ "$map_count" != "$design_count" ]]; then
    error "docs/_indexes/design-map.md row count does not match design docs (index $map_count, source $design_count)"
  fi

  for field in 'design_kind:' 'status: draft' 'validation_status:' 'domain_expert_roles:' 'role_views:' 'retrieval_class:' 'context:' 'default_load:' 'section_load:' 'evidence_only:' 'size_tier:'; do
    require_contains "$DESIGN_TEMPLATE" "$field"
  done

  if ! grep -F "domain-landscape.md" "$DESIGN_README" | grep -Fq "core-start"; then
    error "domain-landscape.md must be marked as core-start in docs/design/README.md"
  fi

  if ! grep -F "context-map.md" "$DESIGN_README" | grep -Fq "context-map"; then
    error "context-map.md must be marked as context-map in docs/design/README.md"
  fi

  if ! grep -F "contexts/retrieval/domain-model.md" "$DESIGN_README" | grep -Fq "domain-current"; then
    error "retrieval bounded-context model must be marked as domain-current in docs/design/README.md"
  fi

  if ! grep -Fq "term section" "$DESIGN_README"; then
    error "docs/design/README.md must document bounded-context term section loading"
  fi
}

validate_context_packets() {
  local referenced_path

  require_file "$CONTEXT_PACKETS" || return

  awk -v path="$CONTEXT_PACKETS" '
    function push_error(message) {
      errors[++error_count] = message
    }

    /^[[:space:]]{4}default_load:[[:space:]]*$/ {
      in_default = 1
      next
    }

    /^[[:space:]]{4}[A-Za-z_][A-Za-z0-9_-]*:[[:space:]]*$/ && $0 !~ /^[[:space:]]{4}default_load:/ {
      in_default = 0
    }

    in_default && /docs\/design\/\*\.md/ {
      push_error("default context packet includes all design docs")
    }

    in_default && /docs\/tasks\/\*\.md/ {
      push_error("default context packet includes all task docs")
    }

    in_default && /docs\/projects\/\*\.md/ {
      push_error("default context packet includes all project docs")
    }

    in_default && /docs\/initiatives\/\*\.md/ {
      push_error("default context packet includes all initiative docs")
    }

    in_default && /docs\/design\/ubiquitous-language\.md/ {
      push_error("default context packet includes full ubiquitous-language.md")
    }

    END {
      for (i = 1; i <= error_count; i++) {
        print "error: " errors[i] " in " path > "/dev/stderr"
      }
      exit error_count ? 1 : 0
    }
  ' "$CONTEXT_PACKETS" || error "context packet manifest has forbidden default load entries"

  require_contains "$CONTEXT_PACKETS" "retrieval_incident:"
  require_contains "$CONTEXT_PACKETS" "docs/architecture/retrieval-plane.md"
  require_contains "$CONTEXT_PACKETS" "docs/guide/hybrid-retrieval-and-freshness.md"
  require_contains "$CONTEXT_PACKETS" "docs/_indexes/retrieval-policy.yaml"

  while IFS= read -r referenced_path; do
    [[ "$referenced_path" == *'*'* ]] && continue
    if [[ ! -e "$REPO_ROOT/$referenced_path" ]]; then
      error "context packet references missing path: $referenced_path"
    fi
  done < <(sed -n 's/^[[:space:]]*-[[:space:]]*\(docs\/[^#[:space:]]*\)[[:space:]]*$/\1/p' "$CONTEXT_PACKETS" | sort -u)
}

policy_scalar() {
  local section="$1"
  local key="$2"

  awk -v wanted_section="$section" -v wanted_key="$key" '
    /^[^[:space:]#][^:]*:/ {
      current_section = $0
      sub(/:.*/, "", current_section)
      next
    }
    current_section == wanted_section && $0 ~ "^  " wanted_key ":[[:space:]]*" {
      value = $0
      sub("^  " wanted_key ":[[:space:]]*", "", value)
      found++
      result = value
    }
    END {
      if (found != 1) exit 2
      print result
    }
  ' "$RETRIEVAL_POLICY"
}

policy_nested_list_contains() {
  local section="$1"
  local list_key="$2"
  local item="$3"

  awk -v wanted_section="$section" -v wanted_list="$list_key" -v wanted_item="$item" '
    /^[^[:space:]#][^:]*:/ {
      current_section = $0
      sub(/:.*/, "", current_section)
      in_list = 0
      next
    }
    current_section == wanted_section && $0 == "  " wanted_list ":" {
      in_list = 1
      next
    }
    current_section == wanted_section && /^  [A-Za-z_][A-Za-z0-9_]*:/ {
      in_list = 0
    }
    in_list && $0 == "    - " wanted_item {
      found++
    }
    END { exit found == 1 ? 0 : 1 }
  ' "$RETRIEVAL_POLICY"
}

validate_policy_schema() {
  awk '
    function contains(list, value) {
      return index("|" list "|", "|" value "|") > 0
    }
    function report(message) {
      print "retrieval policy schema: " NR ": " message > "/dev/stderr"
      invalid = 1
    }
    BEGIN {
      top_scalars = "version|updated"
      sections = "authority|activation|freshness|retrieval|publish|metadata_contracts|mutation|evaluation"

      keys["authority"] = "source_of_truth|index_is_rebuildable"
      keys["activation"] = "profile_before_activation|profile_after_activation|operator_review_project_count|operator_review_overridable|measurement_triggers"
      keys["freshness"] = "same_session|watcher_role|reconciliation_role|normal_lexical_visibility_p95_ms|normal_hybrid_visibility_p95_ms|normal_delete_visibility_p95_ms|reconciliation_convergence_max_ms|direct_read_fallback|direct_dirty_source_union"
      keys["retrieval"] = "exact|lexical|dense|fusion|parameters_provisional|rrf_k|lexical_candidates|dense_candidates|final_results|indexed_only_search"
      keys["publish"] = "coordinator|revision_order|document_head|row_layout|lexical_visibility|hybrid_visibility|query_snapshot|revision_retention|registry_changes|generation_cutover"
      keys["metadata_contracts"] = "registry_entry|document_head|chunk_row|arm_receipt|query_envelope|query_result"
      keys["mutation"] = "identity|doc_id_fallback|catalog_state|update|job_commit_guard|destructive_write_guard|replacement_input|delete|delete_confirmation|rename|transient_absence|physical_cleanup"
      keys["evaluation"] = "required_metrics"

      list_keys["activation"] = "measurement_triggers"
      list_keys["metadata_contracts"] = "registry_entry|document_head|chunk_row|arm_receipt|query_envelope|query_result"
      list_keys["evaluation"] = "required_metrics"

      items["activation.measurement_triggers"] = "document_and_chunk_count|edit_rate|visibility_lag|query_latency|query_concurrency|retrieval_miss_rate"
      items["metadata_contracts.registry_entry"] = "project_id|source_id|valid_from_registry_revision|valid_to_registry_revision|include_exclude_scope|sensitivity_policy|branch_scope|worktree_id"
      items["metadata_contracts.document_head"] = "source_id|doc_id|source_revision|revision_seq|source_hash|relative_path|presence_state|is_tombstone|lexical_active_revision|hybrid_active_revision|pointer_epoch"
      items["metadata_contracts.chunk_row"] = "project_id|source_id|doc_id|chunk_id|doc_type|status|relative_path|heading_path|source_revision|revision_seq|source_hash|content_hash|index_generation|arm|staged_state"
      items["metadata_contracts.arm_receipt"] = "source_id|doc_id|revision_seq|source_hash|arm|indexed_revision|index_generation|backend_commit_version|state"
      items["metadata_contracts.query_envelope"] = "query_text|scope_filter|registry_snapshot_revision|mode|minimum_revision_seq_by_doc|minimum_source_hash_by_doc|logical_read_fence"
      items["metadata_contracts.query_result"] = "project_id|source_id|doc_id|chunk_id|relative_path|heading_path|revision_seq|source_hash|content_hash|index_generation|logical_read_fence|retrieval_provenance|freshness_state"
      items["evaluation.required_metrics"] = "recall_at_10|ndcg_at_10|mrr|exact_identifier_hit_rate|stale_hit_rate|visibility_lag"
    }
    /^[[:space:]]*($|#)/ { next }
    {
      line = $0
      if (index(line, "\t") > 0) {
        report("tabs are not allowed")
        next
      }

      text = line
      sub(/^ */, "", text)
      indent = length(line) - length(text)

      if (substr(text, 1, 2) == "- ") {
        item = substr(text, 3)
        path = section "." current_list
        if (indent != 4 || current_list == "") {
          report("list item has invalid indentation or no parent list: " item)
          next
        }
        if (!contains(items[path], item)) {
          report("unexpected list item at " path ": " item)
          next
        }
        identity = path "." item
        seen[identity]++
        if (seen[identity] > 1) report("duplicate list item: " identity)
        next
      }

      separator = index(text, ":")
      if (separator == 0) {
        report("expected key: value")
        next
      }
      key = substr(text, 1, separator - 1)
      value = substr(text, separator + 1)
      sub(/^ +/, "", value)

      if (indent == 0) {
        current_list = ""
        identity = "top." key
        seen[identity]++
        if (seen[identity] > 1) report("duplicate top-level key: " key)
        if (contains(top_scalars, key)) {
          section = ""
          if (value == "") report("top-level scalar has no value: " key)
        } else if (contains(sections, key)) {
          section = key
          if (value != "") report("section must not have an inline value: " key)
        } else {
          report("unexpected top-level key: " key)
          section = ""
        }
        next
      }

      if (indent == 2 && section != "") {
        identity = section "." key
        seen[identity]++
        if (seen[identity] > 1) report("duplicate key: " identity)
        if (!contains(keys[section], key)) {
          report("unexpected key: " identity)
          current_list = ""
        } else if (contains(list_keys[section], key)) {
          current_list = key
          if (value != "") report("list key must not have an inline value: " identity)
        } else {
          current_list = ""
          if (value == "") report("scalar has no value: " identity)
        }
        next
      }

      report("unsupported indentation or nesting")
    }
    END { exit invalid ? 1 : 0 }
  ' "$RETRIEVAL_POLICY"
}

validate_retrieval_policy() {
  local section
  local spec
  local key
  local expected
  local actual
  local contract

  require_file "$RETRIEVAL_POLICY" || return

  if ! validate_policy_schema; then
    error "retrieval policy must match the closed schema and contain no duplicate keys/items"
  fi

  if [[ "$(grep -Ec '^version:[[:space:]]*2[[:space:]]*$' "$RETRIEVAL_POLICY" || true)" != "1" ]]; then
    error "retrieval policy must declare version 2 exactly once"
  fi

  if [[ "$(grep -Ec '^updated:[[:space:]]*[0-9]{4}-[0-9]{2}-[0-9]{2}[[:space:]]*$' "$RETRIEVAL_POLICY" || true)" != "1" ]]; then
    error "retrieval policy must declare one ISO-8601 updated date"
  fi

  for section in authority activation freshness retrieval publish metadata_contracts mutation evaluation; do
    if [[ "$(grep -Ec "^${section}:[[:space:]]*$" "$RETRIEVAL_POLICY" || true)" != "1" ]]; then
      error "retrieval policy section must appear exactly once: $section"
    fi
  done

  for spec in \
    'authority|source_of_truth|filesystem' \
    'authority|index_is_rebuildable|true' \
    'activation|profile_before_activation|static' \
    'activation|profile_after_activation|hybrid' \
    'activation|operator_review_project_count|30' \
    'activation|operator_review_overridable|true' \
    'freshness|same_session|read_your_writes' \
    'freshness|watcher_role|latency_hint' \
    'freshness|reconciliation_role|correctness_authority' \
    'freshness|normal_lexical_visibility_p95_ms|1000' \
    'freshness|normal_hybrid_visibility_p95_ms|5000' \
    'freshness|normal_delete_visibility_p95_ms|1000' \
    'freshness|reconciliation_convergence_max_ms|120000' \
    'freshness|direct_read_fallback|true' \
    'freshness|direct_dirty_source_union|true' \
    'retrieval|exact|keyword_or_direct_source' \
    'retrieval|lexical|bm25' \
    'retrieval|dense|multilingual' \
    'retrieval|fusion|rrf' \
    'retrieval|parameters_provisional|true' \
    'retrieval|rrf_k|60' \
    'retrieval|lexical_candidates|50' \
    'retrieval|dense_candidates|50' \
    'retrieval|final_results|10' \
    'retrieval|indexed_only_search|false' \
    'publish|coordinator|single_writer_or_compare_and_swap' \
    'publish|revision_order|monotonic_sequence' \
    'publish|document_head|authoritative' \
    'publish|row_layout|revision_keyed_immutable_staging' \
    'publish|lexical_visibility|lexical_revision_pointer' \
    'publish|hybrid_visibility|all_arms_same_revision' \
    'publish|query_snapshot|logical_read_fence' \
    'publish|revision_retention|while_any_pointer_or_query_fence_references' \
    'publish|registry_changes|versioned_snapshot_filter_fail_closed' \
    'publish|generation_cutover|cutoff_replay_watermark_atomic_switch' \
    'mutation|identity|stable_persisted' \
    'mutation|doc_id_fallback|catalog_persisted_identity' \
    'mutation|catalog_state|versioned_and_backup_required' \
    'mutation|update|inactive_revision_staging_then_pointer_publish' \
    'mutation|job_commit_guard|current_head_check_before_pointer_publish' \
    'mutation|destructive_write_guard|lease_before_write_held_through_publish' \
    'mutation|replacement_input|full_document_chunk_manifest' \
    'mutation|delete|tombstone_before_compaction' \
    'mutation|delete_confirmation|settled_readable_scan_or_authoritative_source_signal' \
    'mutation|rename|atomic_old_path_remove_and_new_path_activate' \
    'mutation|transient_absence|present_indeterminate_absent_confirmed' \
    'mutation|physical_cleanup|after_pointer_retirement'
  do
    IFS='|' read -r section key expected <<<"$spec"
    if ! actual="$(policy_scalar "$section" "$key")"; then
      error "retrieval policy scalar must appear exactly once at $section.$key"
    elif [[ "$actual" != "$expected" ]]; then
      error "retrieval policy value mismatch at $section.$key (expected $expected, found $actual)"
    fi
  done

  for expected in \
    document_and_chunk_count edit_rate visibility_lag query_latency query_concurrency retrieval_miss_rate
  do
    if ! policy_nested_list_contains activation measurement_triggers "$expected"; then
      error "retrieval policy activation.measurement_triggers must contain exactly one '$expected'"
    fi
  done

  for contract in \
    'registry_entry|project_id' 'registry_entry|source_id' \
    'registry_entry|valid_from_registry_revision' 'registry_entry|valid_to_registry_revision' \
    'registry_entry|include_exclude_scope' 'registry_entry|sensitivity_policy' \
    'registry_entry|branch_scope' 'registry_entry|worktree_id' \
    'document_head|source_id' 'document_head|doc_id' 'document_head|source_revision' \
    'document_head|revision_seq' 'document_head|source_hash' 'document_head|relative_path' \
    'document_head|presence_state' 'document_head|is_tombstone' \
    'document_head|lexical_active_revision' 'document_head|hybrid_active_revision' \
    'document_head|pointer_epoch' \
    'chunk_row|project_id' 'chunk_row|source_id' 'chunk_row|doc_id' 'chunk_row|chunk_id' \
    'chunk_row|doc_type' 'chunk_row|status' 'chunk_row|relative_path' \
    'chunk_row|heading_path' 'chunk_row|source_revision' 'chunk_row|revision_seq' \
    'chunk_row|source_hash' 'chunk_row|content_hash' 'chunk_row|index_generation' \
    'chunk_row|arm' 'chunk_row|staged_state' \
    'arm_receipt|source_id' 'arm_receipt|doc_id' 'arm_receipt|revision_seq' \
    'arm_receipt|source_hash' 'arm_receipt|arm' 'arm_receipt|indexed_revision' \
    'arm_receipt|index_generation' 'arm_receipt|backend_commit_version' 'arm_receipt|state' \
    'query_envelope|query_text' 'query_envelope|scope_filter' \
    'query_envelope|registry_snapshot_revision' 'query_envelope|mode' \
    'query_envelope|minimum_revision_seq_by_doc' 'query_envelope|minimum_source_hash_by_doc' \
    'query_envelope|logical_read_fence' \
    'query_result|project_id' 'query_result|source_id' 'query_result|doc_id' \
    'query_result|chunk_id' 'query_result|relative_path' 'query_result|heading_path' \
    'query_result|revision_seq' 'query_result|source_hash' 'query_result|content_hash' \
    'query_result|index_generation' 'query_result|logical_read_fence' \
    'query_result|retrieval_provenance' 'query_result|freshness_state'
  do
    IFS='|' read -r key expected <<<"$contract"
    if ! policy_nested_list_contains metadata_contracts "$key" "$expected"; then
      error "retrieval policy metadata_contracts.$key must contain exactly one '$expected'"
    fi
  done

  for expected in recall_at_10 ndcg_at_10 mrr exact_identifier_hit_rate stale_hit_rate visibility_lag; do
    if ! policy_nested_list_contains evaluation required_metrics "$expected"; then
      error "retrieval policy evaluation.required_metrics must contain exactly one '$expected'"
    fi
  done

  if grep -Eq 'indexed_only_search:[[:space:]]*true' "$RETRIEVAL_POLICY"; then
    error "retrieval policy must not enable indexed-only search"
  fi

  if grep -Eq '(^|[^[:alnum:]_])/Users/|file://' "$RETRIEVAL_POLICY"; then
    error "retrieval policy must not contain local absolute paths or file:// URIs"
  fi
}

validate_retrieval_docs() {
  local section

  require_file "$RETRIEVAL_DESIGN" || return
  require_file "$HYBRID_GUIDE" || return

  for section in \
    Purpose 'Whole-System Role' 'Authority Boundary' Invariants 'Scale Activation' \
    'Retrieval Components' Interfaces 'Revision And Identity' \
    'Incremental Projection' 'Publish And Concurrency Contract' 'Query Contract' 'Freshness Contract' \
    'Failure Recovery' 'Failure Boundaries' 'Evaluation Contract' 'Quality Axes' \
    Decisions 'Artifact Contracts' 'Open Questions' References 'Change Log'
  do
    require_section "$RETRIEVAL_DESIGN" "$section"
  done

  for section in \
    Purpose 'Operating Principle' 'Profile Selection' 'Ingest Loop' 'Query Loop' \
    'Same-Session Freshness' 'Delete And Rename' 'Evaluation And Operations' \
    'Failure Response' References 'Change Log'
  do
    require_section "$HYBRID_GUIDE" "$section"
  done

  require_contains "$RETRIEVAL_DESIGN" "docs/_indexes/retrieval-policy.yaml"
  require_contains "$HYBRID_GUIDE" "docs/_indexes/retrieval-policy.yaml"
  require_contains "$RETRIEVAL_DESIGN" "static validator"
  require_contains "$HYBRID_GUIDE" "runtime freshness"
}

validate_source_ref_symmetry() {
  local file

  while IFS= read -r file; do
    if ! awk '
      NR == 1 && $0 == "---" { in_frontmatter = 1; next }
      in_frontmatter && $0 == "---" { in_frontmatter = 0; in_source_refs = 0; next }
      in_frontmatter && /^source_refs:[[:space:]]*$/ { in_source_refs = 1; next }
      in_frontmatter && in_source_refs && /^[^[:space:]][^:]*:/ { in_source_refs = 0 }
      in_frontmatter && in_source_refs && /^  -[[:space:]]+[^[:space:]]/ { has_source_ref = 1 }
      !in_frontmatter && /^## (References|Inputs)[[:space:]]*$/ { has_body_sources = 1 }
      END { exit has_source_ref && !has_body_sources ? 1 : 0 }
    ' "$file"; then
      error "non-empty source_refs requires a body References or Inputs section: ${file#$REPO_ROOT/}"
    fi
  done < <(find "$DOCS_DIR" -type f -name '*.md' | sort)
}

validate_active_folder "$DOCS_DIR/initiatives" 'I*.md'
validate_active_folder "$DOCS_DIR/projects" 'P*.md'
validate_active_folder "$DOCS_DIR/tasks" 'T*.md'
validate_active_folder "$DOCS_DIR/reports" '*.md'
validate_active_folder "$DOCS_DIR/qa" 'QA*.md'
validate_active_docs_section "$DOCS_DIR/initiatives" 'I*.md' "## Active Initiatives"
validate_active_docs_section "$DOCS_DIR/projects" 'P*.md' "## Active Projects"
validate_active_docs_section "$DOCS_DIR/tasks" 'T*.md' "## Active Tasks"
validate_active_docs_section "$DOCS_DIR/reports" '*.md' "## Active Reports"
validate_active_docs_section "$DOCS_DIR/qa" 'QA*.md' "## Active QA"
validate_design_indexes
validate_context_packets
validate_retrieval_policy
validate_retrieval_docs
validate_source_ref_symmetry

if (( error_count > 0 )); then
  exit 1
fi

echo "Validated doc retrieval surfaces."
