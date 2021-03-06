GET Model Table Unsorted Indices
================================

.. http:get:: /models/(mid)/tables/(name)/arrays/(array)/unsorted-indices

  Given a collection of sorted row indices and a specific sort order,
  return the corresponding unsorted row indices.

  :param mid: Unique model identifier.
  :type mid: string

  :param name: Arrayset artifact name.
  :type name: string

  :param array: Array index.
  :type array: int

  :query rows: Row indices to be sorted.
  :query index: Optional index column that can be used for sorting.
  :query sort: Sort order.
  :query byteorder: Optionally return the results as binary data.
  :responseheader Content-Type: application/json, application/octet-stream

See Also
--------

- :http:get:`/models/(mid)/tables/(name)/arrays/(array)/chunk`
- :http:get:`/models/(mid)/tables/(name)/arrays/(array)/metadata`
- :http:get:`/models/(mid)/tables/(name)/arrays/(array)/sorted-indices`
